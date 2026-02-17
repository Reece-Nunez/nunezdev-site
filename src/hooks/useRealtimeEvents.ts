import { useEffect, useRef, useCallback, useState } from 'react';

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
  invoice_id?: string;
  client_id?: string;
  created_at: string;
}

interface UseRealtimeEventsOptions {
  // Optional filters
  invoiceId?: string;
  clientId?: string;
  // Event handlers
  onPaymentReceived?: (event: RealtimeEvent) => void;
  onInstallmentPaid?: (event: RealtimeEvent) => void;
  onInvoicePaid?: (event: RealtimeEvent) => void;
  onAnyEvent?: (event: RealtimeEvent) => void;
  // Auto-refresh callback - called when any relevant event is received
  onRefresh?: () => void;
  // Whether to enable SSE (default: true)
  enabled?: boolean;
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Store callbacks in refs to avoid triggering reconnects when they change
  const callbackRefs = useRef({
    onPaymentReceived,
    onInstallmentPaid,
    onInvoicePaid,
    onAnyEvent,
    onRefresh,
  });

  // Update refs when callbacks change (without causing reconnect)
  useEffect(() => {
    callbackRefs.current = {
      onPaymentReceived,
      onInstallmentPaid,
      onInvoicePaid,
      onAnyEvent,
      onRefresh,
    };
  });

  const connect = useCallback(() => {
    if (!enabled) return;

    // Build URL with optional filters
    const params = new URLSearchParams();
    if (invoiceId) params.set('invoice_id', invoiceId);
    if (clientId) params.set('client_id', clientId);

    const url = `/api/events/stream${params.toString() ? `?${params.toString()}` : ''}`;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('[SSE] Connecting to:', url);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (e) => {
      console.log('[SSE] Connected:', e.data);
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    });

    eventSource.addEventListener('payment_received', (e) => {
      const event: RealtimeEvent = JSON.parse(e.data);
      console.log('[SSE] Payment received:', event);
      setLastEvent(event);
      callbackRefs.current.onPaymentReceived?.(event);
      callbackRefs.current.onAnyEvent?.(event);
      callbackRefs.current.onRefresh?.();
    });

    eventSource.addEventListener('installment_paid', (e) => {
      const event: RealtimeEvent = JSON.parse(e.data);
      console.log('[SSE] Installment paid:', event);
      setLastEvent(event);
      callbackRefs.current.onInstallmentPaid?.(event);
      callbackRefs.current.onAnyEvent?.(event);
      callbackRefs.current.onRefresh?.();
    });

    eventSource.addEventListener('invoice_paid', (e) => {
      const event: RealtimeEvent = JSON.parse(e.data);
      console.log('[SSE] Invoice paid:', event);
      setLastEvent(event);
      callbackRefs.current.onInvoicePaid?.(event);
      callbackRefs.current.onAnyEvent?.(event);
      callbackRefs.current.onRefresh?.();
    });

    eventSource.onerror = (error) => {
      console.log('[SSE] Connection error, will reconnect:', error);
      setIsConnected(false);
      eventSource.close();

      // Exponential backoff for reconnection
      const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[SSE] Attempting reconnection...');
        connect();
      }, backoffMs);
    };

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      setIsConnected(true);
    };
  }, [enabled, invoiceId, clientId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    reconnect: connect,
    disconnect,
  };
}
