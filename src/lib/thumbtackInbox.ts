/**
 * Phase C — thread a Thumbtack message event into the inbox.
 *
 * Server-only. Thumbtack messages use a dedicated 'thumbtack' channel (added to
 * the conversations/messages CHECK constraints by the add_thumbtack_channel
 * migration). We keep this separate from @/lib/inbox.ts — those helpers encode
 * email/sms-specific routing (Reply-To addresses, E.164) that doesn't apply
 * here.
 *
 * IMPORTANT: a real Thumbtack *message* payload has not been observed yet (only
 * a lead event). The field paths below are best-effort. To avoid threading empty
 * or wrong data, we only create a message when we can extract BOTH a contact
 * handle (phone) AND non-empty body text; otherwise we report 'message_unmappable'
 * and the event is left unprocessed for a later pass once the shape is confirmed.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhoneE164 } from '@/lib/sms';
import type { ProcessResult } from '@/lib/thumbtackProcessor';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function asStr(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

interface ExtractedMessage {
  phone: string | null;
  contactName: string | null;
  body: string | null;
  messageId: string | null;
}

// Best-effort extraction across plausible message-payload shapes. Revisit once
// a real Thumbtack message delivery confirms the actual field names.
function extractMessage(payload: unknown): ExtractedMessage {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : {};
  const customer = isRecord(data.customer) ? data.customer : {};
  const message = isRecord(data.message) ? data.message : {};

  const body =
    asStr(message.text) ?? asStr(message.body) ?? asStr(data.text) ?? asStr(data.body);
  const first = asStr(customer.firstName);
  const last = asStr(customer.lastName);

  return {
    phone: asStr(customer.phone),
    contactName: [first, last].filter(Boolean).join(' ') || null,
    body,
    messageId: asStr(data.messageID) ?? asStr(message.id),
  };
}

async function findOrCreateThumbtackConversation(params: {
  phone: string;
  contactName: string | null;
}): Promise<string> {
  const supabase = supabaseAdmin();
  const phone = normalizePhoneE164(params.phone) ?? params.phone;

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('channel', 'thumbtack')
    .eq('status', 'open')
    .eq('contact_phone', phone)
    .limit(1);
  if (existing?.[0]) return existing[0].id as string;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      channel: 'thumbtack',
      contact_phone: phone,
      contact_name: params.contactName,
    })
    .select('id')
    .single();
  if (error) throw new Error(`failed to create thumbtack conversation: ${error.message}`);
  return data.id as string;
}

export async function threadThumbtackMessage(payload: unknown): Promise<ProcessResult> {
  const msg = extractMessage(payload);

  // Refuse to thread without both a routable handle and real content — better to
  // defer (unprocessed) than to create an empty/garbage conversation.
  if (!msg.phone || !msg.body) {
    return {
      status: 'message_unmappable',
      detail: 'message payload shape not yet confirmed (need phone + body)',
    };
  }

  const supabase = supabaseAdmin();
  const conversationId = await findOrCreateThumbtackConversation({
    phone: msg.phone,
    contactName: msg.contactName,
  });

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    direction: 'inbound',
    channel: 'thumbtack',
    from_address: msg.phone,
    to_address: 'thumbtack',
    body_text: msg.body,
    provider_id: msg.messageId, // unique index dedups retries when present
    status: 'received',
  });

  // Duplicate delivery (unique provider_id) is success — already threaded.
  if (error && error.code !== '23505') {
    return { status: 'error', detail: error.message };
  }
  return { status: 'message_threaded', conversationId };
}
