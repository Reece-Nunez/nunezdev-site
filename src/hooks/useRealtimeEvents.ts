/**
 * Real-time event subscription via Supabase Realtime (Postgres → WebSocket).
 *
 * Previous implementation polled a custom SSE endpoint every 2 seconds and
 * had a 30s forced reconnect cycle (Vercel function timeouts). That generated
 * 1,800+ DB queries / hour per open dashboard tab and spammed the console.
 *
 * This version subscribes directly to INSERTs on the `realtime_events`
 * table. The Supabase Realtime gateway respects RLS, so the existing
 * org-scoped SELECT policy automatically filters events to the user's org.
 *
 * Hardened against the failure modes the QC audit caught:
 *   - Long-lived tabs: hook subscribes to auth.onAuthStateChange and pushes
 *     refreshed JWTs into the Realtime socket so subscriptions don't go
 *     silently dead at the ~1 hour mark.
 *   - Initial-state gap: on SUBSCRIBED, runs a one-shot backfill query for
 *     any events the user missed during the brief mount → connected window.
 *   - Filter injection: validates invoiceId / clientId look like UUIDs
 *     before injecting into the realtime filter string. Bad UUID → silent
 *     fallback to unfiltered subscribe (RLS still scopes to org).
 *   - Same Supabase client instance reused across subscribe + cleanup.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabaseClient';

export interface RealtimeEvent {
  id: string;
  org_id: string;
  event_type: string;
  event_data: {
    invoice_id?: string;
    invoice_number?: string;
    client_name?: string;
    amount_cents?: number;
    installment_id?: string;
    installment_label?: string;
    payment_method?: string;
    [key: string]: unknown;
  };
  invoice_id?: string | null;
  client_id?: string | null;
  created_at: string;
}

interface UseRealtimeEventsOptions {
  invoiceId?: string;
  clientId?: string;
  onPaymentReceived?: (event: RealtimeEvent) => void;
  onInstallmentPaid?: (event: RealtimeEvent) => void;
  onInvoicePaid?: (event: RealtimeEvent) => void;
  onAnyEvent?: (event: RealtimeEvent) => void;
  onRefresh?: () => void;
  enabled?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dispatch(
  event: RealtimeEvent,
  handlers: {
    onPaymentReceived?: (e: RealtimeEvent) => void;
    onInstallmentPaid?: (e: RealtimeEvent) => void;
    onInvoicePaid?: (e: RealtimeEvent) => void;
    onAnyEvent?: (e: RealtimeEvent) => void;
    onRefresh?: () => void;
  }
) {
  switch (event.event_type) {
    case 'payment_received':
      handlers.onPaymentReceived?.(event);
      break;
    case 'installment_paid':
      handlers.onInstallmentPaid?.(event);
      break;
    case 'invoice_paid':
      handlers.onInvoicePaid?.(event);
      break;
  }
  handlers.onAnyEvent?.(event);
  handlers.onRefresh?.();
}

export function useRealtimeEvents({
  invoiceId,
  clientId,
  onPaymentReceived,
  onInstallmentPaid,
  onInvoicePaid,
  onAnyEvent,
  onRefresh,
  enabled = true,
}: UseRealtimeEventsOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Latest handlers — synced on every relevant render via a deps-aware effect
  const handlersRef = useRef({
    onPaymentReceived,
    onInstallmentPaid,
    onInvoicePaid,
    onAnyEvent,
    onRefresh,
  });
  useEffect(() => {
    handlersRef.current = {
      onPaymentReceived,
      onInstallmentPaid,
      onInvoicePaid,
      onAnyEvent,
      onRefresh,
    };
  }, [onPaymentReceived, onInstallmentPaid, onInvoicePaid, onAnyEvent, onRefresh]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    // Validate filter inputs — bad UUIDs would break the channel subscribe.
    // Fall back to unfiltered subscribe (RLS still scopes by org).
    const safeInvoiceId = invoiceId && UUID_RE.test(invoiceId) ? invoiceId : undefined;
    const safeClientId = clientId && UUID_RE.test(clientId) ? clientId : undefined;

    const supabase = createClient();
    supabaseRef.current = supabase;

    // Keep Realtime auth in lock-step with the session. Without this,
    // when Supabase rotates the JWT after ~1 hour, the Realtime gateway
    // starts rejecting RLS and events silently stop arriving even though
    // the socket stays "connected."
    const authSub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    // Channel name includes filters so multiple hook instances with
    // different filters don't share state.
    const channelName = `realtime_events:${safeInvoiceId || 'any'}:${safeClientId || 'any'}`;

    // Realtime postgres filter — single clause only (server-side limitation).
    // Prefer invoiceId since it's more specific; fall back to clientId.
    let filter: string | undefined;
    if (safeInvoiceId) filter = `invoice_id=eq.${safeInvoiceId}`;
    else if (safeClientId) filter = `client_id=eq.${safeClientId}`;

    // Record the mount time so the post-subscribe backfill knows which
    // events to grab (anything inserted since we started listening).
    const subscribeStartedAt = new Date().toISOString();

    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'realtime_events',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const event = payload.new as RealtimeEvent;
          setLastEvent(event);
          dispatch(event, handlersRef.current);
        }
      )
      .subscribe(async (status) => {
        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);

        // Plug the initial-state gap: on first successful subscribe, fetch
        // anything that arrived between component mount and the channel
        // going live. The same RLS policy gates this query, so we only see
        // events for the user's org.
        if (connected) {
          try {
            let q = supabase
              .from('realtime_events')
              .select('*')
              .gte('created_at', subscribeStartedAt)
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: true })
              .limit(50);
            if (safeInvoiceId) q = q.eq('invoice_id', safeInvoiceId);
            else if (safeClientId) q = q.eq('client_id', safeClientId);
            const { data } = await q;
            if (data && data.length > 0) {
              for (const raw of data) {
                const event = raw as RealtimeEvent;
                setLastEvent(event);
                dispatch(event, handlersRef.current);
              }
            }
          } catch {
            // Backfill is best-effort — failure doesn't break the live stream.
          }
        }
      });

    channelRef.current = channel;

    return () => {
      authSub.data.subscription.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, invoiceId, clientId]);

  return {
    isConnected,
    lastEvent,
    // Kept for API back-compat with the previous SSE hook
    reconnect: () => {},
    disconnect: () => {
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    },
  };
}
