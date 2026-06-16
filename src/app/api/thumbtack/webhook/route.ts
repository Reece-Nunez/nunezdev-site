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
 * Storage: we land every delivery verbatim in thumbtack_events (raw jsonb),
 * then process it into the app's own records (lead -> expense, message ->
 * inbox) best-effort. See create_thumbtack_events.sql and thumbtackProcessor.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyWebhookSecret, parseThumbtackEvent } from '@/lib/thumbtackWebhook';
import { processThumbtackEvent } from '@/lib/thumbtackProcessor';

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

  // Pull the indexed columns from the payload (full body is stored raw either
  // way). Extraction is defensive — it never throws and never drops the event.
  const { eventType, externalId, businessId } = parseThumbtackEvent(payload);

  const supabase = supabaseAdmin();
  const { data: inserted, error } = await supabase
    .from('thumbtack_events')
    .insert({
      event_type: eventType,
      external_id: externalId,
      business_id: businessId,
      payload: payload ?? {},
    })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique violation on external_id -> this is a redelivery of an
    // event we already stored (and already processed). Ack 200 so Thumbtack
    // stops retrying.
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // Any other write failure: return 500 so Thumbtack retries the delivery
    // rather than dropping the lead/message on the floor.
    console.error('[thumbtack/webhook] store failed:', error);
    return NextResponse.json({ error: 'store_failed' }, { status: 500 });
  }

  // Process inline (lead -> expense, message -> inbox). Best-effort: the raw
  // event is already safely stored, so a processing failure must NOT fail the
  // webhook (that would make Thumbtack retry, hit the unique constraint, and
  // ack as a duplicate without ever reprocessing). On failure the event stays
  // processed=false and the /api/thumbtack/process backfill route retries it.
  let processed: string | undefined;
  try {
    const result = await processThumbtackEvent({ id: inserted.id, payload: payload ?? {} });
    processed = result.status;
  } catch (e) {
    console.error('[thumbtack/webhook] processing failed (event stored, will retry):', e);
  }

  return NextResponse.json({ ok: true, processed });
}
