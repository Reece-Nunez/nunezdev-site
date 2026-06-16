/**
 * Thumbtack event processor — turns rows landed in `thumbtack_events` into the
 * app's own records:
 *   - lead events      -> a lead-fee expense (so prices stop being manual)
 *   - message events   -> an inbox conversation/message (Phase C)
 *
 * Server-only: uses the Supabase service-role client. Pure parsing lives in
 * `@/lib/thumbtackWebhook` (unit-tested); this module is the DB-touching glue.
 *
 * Idempotency has two layers: the event row's `processed` flag (so a processed
 * event is never re-scanned) and a negotiation-id check against existing
 * expenses (so even a reprocess can't double-charge a lead fee).
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  parseThumbtackEvent,
  extractLeadDetails,
  isThumbtackLeadEvent,
} from '@/lib/thumbtackWebhook';
import { threadThumbtackMessage } from '@/lib/thumbtackInbox';

export type ProcessStatus =
  | 'expense_created'
  | 'skipped_duplicate'
  | 'skipped_no_price'
  | 'skipped_not_lead'
  | 'skipped_no_org'
  | 'message_threaded'
  | 'message_unmappable'
  | 'error';

export interface ProcessResult {
  status: ProcessStatus;
  expenseId?: string;
  conversationId?: string;
  detail?: string;
}

// Statuses after which the event is fully handled and should be marked
// processed. Transient/unknown outcomes are left unprocessed so a later backfill
// (or a future Phase C with a known message shape) can retry them.
const TERMINAL: ReadonlySet<ProcessStatus> = new Set([
  'expense_created',
  'skipped_duplicate',
  'skipped_no_price',
  'skipped_not_lead',
  'message_threaded',
]);

type SupabaseAdmin = ReturnType<typeof supabaseAdmin>;

/**
 * The org lead-fee expenses belong to. The webhook has no session, and there
 * can be more than one `owner` org (e.g. a seed/demo org), so we don't guess
 * from org_members. Resolution order:
 *   1. THUMBTACK_ORG_ID env (explicit override)
 *   2. the org that already owns Thumbtack lead-fee expenses (the active org)
 */
export async function resolveThumbtackOrgId(supabase: SupabaseAdmin): Promise<string | null> {
  const fromEnv = process.env.THUMBTACK_ORG_ID?.trim();
  if (fromEnv) return fromEnv;

  const { data } = await supabase
    .from('expenses')
    .select('org_id')
    .eq('vendor', 'Thumbtack')
    .eq('category', 'lead_fees')
    .not('org_id', 'is', null)
    .limit(1);
  return (data?.[0]?.org_id as string | undefined) ?? null;
}

/** Best-effort client match by exact (case-insensitive) name within the org. */
async function matchClientId(
  supabase: SupabaseAdmin,
  orgId: string,
  name: string | null,
): Promise<string | null> {
  if (!name) return null;
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('org_id', orgId)
    .ilike('name', name)
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

/**
 * Process a single event row. Creates the downstream record (expense or inbox
 * message), marks the event processed on a terminal outcome, and returns what
 * happened. Never throws for ordinary "can't map this" cases — those are
 * returned as a status so the caller can summarize.
 */
export async function processThumbtackEvent(eventRow: {
  id: string;
  payload: unknown;
}): Promise<ProcessResult> {
  const supabase = supabaseAdmin();
  const { eventType } = parseThumbtackEvent(eventRow.payload);

  let result: ProcessResult;

  if (/message/i.test(eventType ?? '')) {
    // Phase C: thread into the inbox (best-effort until the message payload
    // shape is confirmed from a real delivery).
    result = await threadThumbtackMessage(eventRow.payload);
  } else if (isThumbtackLeadEvent(eventType)) {
    result = await createLeadExpense(supabase, eventRow.payload);
  } else {
    result = { status: 'skipped_not_lead', detail: eventType ?? 'unknown' };
  }

  if (TERMINAL.has(result.status)) {
    await supabase
      .from('thumbtack_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', eventRow.id);
  }
  return result;
}

async function createLeadExpense(
  supabase: SupabaseAdmin,
  payload: unknown,
): Promise<ProcessResult> {
  const lead = extractLeadDetails(payload);

  // No price -> nothing to record as an expense (still a terminal skip; the
  // lead itself is visible via the Thumbtack leads view, which reads events).
  if (lead.leadPriceCents == null) return { status: 'skipped_no_price' };

  const orgId = await resolveThumbtackOrgId(supabase);
  if (!orgId) return { status: 'skipped_no_org' }; // transient: configure org, retry

  // Dedup: the negotiation id is stamped into expense notes; if an expense for
  // this negotiation already exists, don't create a second one.
  if (lead.negotiationID) {
    const { data: dup } = await supabase
      .from('expenses')
      .select('id')
      .eq('org_id', orgId)
      .eq('vendor', 'Thumbtack')
      .ilike('notes', `%${lead.negotiationID}%`)
      .limit(1);
    if (dup?.[0]) return { status: 'skipped_duplicate', expenseId: dup[0].id as string };
  }

  const clientId = await matchClientId(supabase, orgId, lead.customerName);

  const notes = [
    lead.category ? `Thumbtack lead - ${lead.category}` : 'Thumbtack lead',
    lead.description ? `"${lead.description}"` : null,
    lead.negotiationID ? `Negotiation ${lead.negotiationID}` : null,
    clientId ? null : 'Lead not converted',
  ]
    .filter(Boolean)
    .join('. ');

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      org_id: orgId,
      description: `Thumbtack lead fee - ${lead.customerName ?? 'Unknown'}`,
      amount_cents: lead.leadPriceCents,
      expense_date: lead.createdAtDate ?? new Date().toISOString().slice(0, 10),
      category: 'lead_fees',
      vendor: 'Thumbtack',
      client_id: clientId,
      is_billable: false,
      is_tax_deductible: true,
      notes,
    })
    .select('id')
    .single();

  if (error) return { status: 'error', detail: error.message };
  return { status: 'expense_created', expenseId: data.id as string };
}

export interface BackfillSummary {
  scanned: number;
  byStatus: Record<string, number>;
}

/**
 * Process all unprocessed events oldest-first (uses the partial index on
 * received_at WHERE processed = false). Used by the backfill route to catch
 * events that arrived before processing existed and to retry transient skips.
 */
export async function processUnprocessedThumbtackEvents(limit = 200): Promise<BackfillSummary> {
  const supabase = supabaseAdmin();
  const { data: events } = await supabase
    .from('thumbtack_events')
    .select('id, payload')
    .eq('processed', false)
    .order('received_at', { ascending: true })
    .limit(limit);

  const byStatus: Record<string, number> = {};
  for (const ev of events ?? []) {
    const r = await processThumbtackEvent({ id: ev.id as string, payload: ev.payload });
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  return { scanned: events?.length ?? 0, byStatus };
}
