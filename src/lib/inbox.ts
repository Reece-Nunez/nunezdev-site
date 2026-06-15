/**
 * Inbox helpers — conversation resolution + message logging shared by the
 * composer (outbound), the Twilio SMS webhook (Phase 3), and the Resend
 * inbound-email webhook (Phase 4).
 *
 * Server-only: uses the Supabase service-role client. Never import this into
 * a Client Component — it would pull the service key into the browser bundle
 * and break the Vercel build.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhoneE164 } from '@/lib/sms';

// Pure threading helpers live in a separate, alias-free module so they can be
// unit-tested under tsx (which doesn't resolve `@/`). Re-export for callers.
export {
  INBOX_REPLY_DOMAIN,
  buildReplyToAddress,
  parseConversationIdFromAddress,
} from '@/lib/inboxThreading';

/**
 * Phone-number variants for matching against clients/leads columns, which
 * may hold "(580) 555-1234", "5805551234", "+15805551234", etc. Mirrors the
 * logic in the SMS webhook so opt-out and inbox resolution agree.
 */
function phoneVariants(input: string): string[] {
  const digits = input.replace(/\D/g, '');
  const variants = new Set<string>([input, digits]);
  if (digits.length === 11 && digits.startsWith('1')) {
    variants.add(`+${digits}`);
    variants.add(digits.slice(1));
    variants.add(`+1${digits.slice(1)}`);
  }
  if (digits.length === 10) {
    variants.add(`+1${digits}`);
    variants.add(`1${digits}`);
  }
  return [...variants];
}

export interface ResolvedContact {
  clientId: string | null;
  leadId: string | null;
  orgId: string | null;
  contactName: string | null;
}

/**
 * Best-effort resolution of an email/phone to a clients or leads row.
 * clients win over leads (a real client is the stronger record), and only
 * clients carry org_id. Returns all-null when nothing matches — an inbox
 * thread can still exist for a stranger.
 */
export async function resolveContact(params: {
  email?: string | null;
  phone?: string | null;
}): Promise<ResolvedContact> {
  const supabase = supabaseAdmin();
  const email = params.email?.trim().toLowerCase() || null;
  const phone = params.phone?.trim() || null;
  const variants = phone ? phoneVariants(phone) : [];

  // clients first — they carry org_id and outrank leads.
  if (email || variants.length) {
    let q = supabase.from('clients').select('id, name, org_id').limit(1);
    q = email && variants.length
      ? q.or(`email.ilike.${email},phone.in.(${variants.join(',')})`)
      : email
        ? q.ilike('email', email)
        : q.in('phone', variants);
    const { data } = await q;
    const c = data?.[0];
    if (c) {
      return { clientId: c.id, leadId: null, orgId: c.org_id ?? null, contactName: c.name ?? null };
    }
  }

  if (email || variants.length) {
    let q = supabase.from('leads').select('id, name').limit(1);
    q = email && variants.length
      ? q.or(`email.ilike.${email},phone.in.(${variants.join(',')})`)
      : email
        ? q.ilike('email', email)
        : q.in('phone', variants);
    const { data } = await q;
    const l = data?.[0];
    if (l) {
      return { clientId: null, leadId: l.id, orgId: null, contactName: l.name ?? null };
    }
  }

  return { clientId: null, leadId: null, orgId: null, contactName: null };
}

export type Channel = 'email' | 'sms';

/**
 * Find an existing open conversation for this channel+identity, or create one.
 * Identity is canonical: email lowercased, phone normalized to E.164. Contact
 * resolution (client/lead/org) runs on create so the new thread is linked.
 */
export async function findOrCreateConversation(params: {
  channel: Channel;
  contactEmail?: string | null;
  contactPhone?: string | null;
  subject?: string | null;
}): Promise<{ id: string; created: boolean }> {
  const supabase = supabaseAdmin();
  const email = params.contactEmail?.trim().toLowerCase() || null;
  const phone = params.contactPhone ? normalizePhoneE164(params.contactPhone) : null;

  if (params.channel === 'email' && !email) throw new Error('email conversation requires an email');
  if (params.channel === 'sms' && !phone) throw new Error('sms conversation requires a valid phone');

  // Look for an existing OPEN thread on this channel for this identity.
  let find = supabase
    .from('conversations')
    .select('id')
    .eq('channel', params.channel)
    .eq('status', 'open')
    .limit(1);
  find = params.channel === 'email'
    ? find.ilike('contact_email', email as string)
    : find.eq('contact_phone', phone as string);
  const { data: existing } = await find;
  if (existing?.[0]) return { id: existing[0].id, created: false };

  const contact = await resolveContact({ email, phone });
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      channel: params.channel,
      contact_email: email,
      contact_phone: phone,
      client_id: contact.clientId,
      lead_id: contact.leadId,
      org_id: contact.orgId,
      contact_name: contact.contactName,
      subject: params.subject ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`failed to create conversation: ${error.message}`);
  return { id: data.id, created: true };
}

export interface RecordMessageParams {
  conversationId: string;
  direction: 'inbound' | 'outbound';
  channel: Channel;
  fromAddress: string;
  toAddress: string;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  provider?: 'resend' | 'twilio' | null;
  providerId?: string | null;
  status?: 'queued' | 'sent' | 'delivered' | 'failed' | 'received';
  error?: string | null;
  sentBy?: string | null;
}

/**
 * Insert a message row. The DB trigger bump_conversation_on_message updates
 * the conversation's tail/unread, so callers don't touch the conversation.
 * Idempotent on providerId via the unique partial index — a webhook retry
 * returns the existing row instead of erroring.
 */
export async function recordMessage(
  params: RecordMessageParams,
): Promise<{ id: string }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      direction: params.direction,
      channel: params.channel,
      from_address: params.fromAddress,
      to_address: params.toAddress,
      subject: params.subject ?? null,
      body_text: params.bodyText ?? null,
      body_html: params.bodyHtml ?? null,
      provider: params.provider ?? null,
      provider_id: params.providerId ?? null,
      status: params.status ?? 'sent',
      error: params.error ?? null,
      sent_by: params.sentBy ?? null,
    })
    .select('id')
    .single();

  // Unique-violation on provider_id means a duplicate webhook delivery; fetch
  // and return the row we already have rather than failing the request.
  if (error) {
    if (error.code === '23505' && params.providerId) {
      const { data: dup } = await supabase
        .from('messages')
        .select('id')
        .eq('provider_id', params.providerId)
        .single();
      if (dup) return { id: dup.id };
    }
    throw new Error(`failed to record message: ${error.message}`);
  }
  return { id: data.id };
}
