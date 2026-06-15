/**
 * Inbound webhook for Thumbtack (lead details, messages, reviews).
 *
 * Configured in Thumbtack's Webhooks UI with this endpoint URL:
 *   https://www.nunezdev.com/api/thumbtack/webhook
 *
 * Security: Thumbtack's webhook form has no payload signing — instead you set
 * an "Authorization type" and a secret that Thumbtack sends on every request.
 * Set that secret to THUMBTACK_WEBHOOK_SECRET. This endpoint is public, so we
 * fail closed: no/!matching secret -> 401, and no secret configured -> 401.
 *
 * Storage: we land every delivery verbatim in thumbtack_events (raw jsonb) and
 * map it into the inbox in a separate pass. See create_thumbtack_events.sql.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyWebhookSecret } from '@/lib/thumbtackWebhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req.headers.get('authorization'), process.env.THUMBTACK_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Best-effort field extraction. The exact payload shape is unknown until real
  // deliveries arrive, so we probe a few likely keys and otherwise rely on the
  // raw jsonb. Nothing here is allowed to drop the event.
  const body = (payload ?? {}) as Record<string, unknown>;
  const eventType = body.event_type ?? body.type ?? body.event ?? null;
  const externalId = body.id ?? body.event_id ?? body.lead_id ?? null;
  const businessId = body.business_id ?? body.business ?? body.profile_id ?? null;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('thumbtack_events').insert({
    event_type: eventType != null ? String(eventType) : null,
    external_id: externalId != null ? String(externalId) : null,
    business_id: businessId != null ? String(businessId) : null,
    payload: body,
  });

  if (error) {
    // 23505 = unique violation on external_id -> this is a redelivery of an
    // event we already stored. Ack 200 so Thumbtack stops retrying.
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // Any other write failure: return 500 so Thumbtack retries the delivery
    // rather than dropping the lead/message on the floor.
    console.error('[thumbtack/webhook] store failed:', error);
    return NextResponse.json({ error: 'store_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
