/**
 * Phase C — thread a Thumbtack message event into the inbox.
 *
 * Server-only. Thumbtack messages use a dedicated 'thumbtack' channel (added by
 * the add_thumbtack_channel migration). They carry no email/phone — only a
 * negotiationID (the thread), a messageID, and display names — so the
 * conversation is keyed on contact_external_id = negotiationID (added by the
 * add_thumbtack_conversation_identity migration). Kept separate from
 * @/lib/inbox.ts, whose helpers encode email/sms routing that doesn't apply.
 *
 * Note: replying to a Thumbtack thread requires the Thumbtack messaging API
 * (pending OAuth approval), so this is inbound/outbound *display* only — the
 * inbox composer can't send back over this channel yet.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { extractThumbtackMessage } from '@/lib/thumbtackWebhook';
import type { ProcessResult } from '@/lib/thumbtackProcessor';

/** Find the conversation for this negotiation, or create it. */
async function findOrCreateThumbtackConversation(params: {
  negotiationID: string;
  customerName: string | null;
}): Promise<string> {
  const supabase = supabaseAdmin();

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('channel', 'thumbtack')
    .eq('contact_external_id', params.negotiationID)
    .limit(1);
  if (existing?.[0]) return existing[0].id as string;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      channel: 'thumbtack',
      contact_external_id: params.negotiationID,
      contact_name: params.customerName,
    })
    .select('id')
    .single();
  if (error) throw new Error(`failed to create thumbtack conversation: ${error.message}`);
  return data.id as string;
}

export async function threadThumbtackMessage(payload: unknown): Promise<ProcessResult> {
  const msg = extractThumbtackMessage(payload);

  // Need the thread key and some content; otherwise defer (leave unprocessed).
  if (!msg.negotiationID || !msg.text) {
    return { status: 'message_unmappable', detail: 'missing negotiationID or text' };
  }

  const supabase = supabaseAdmin();
  const conversationId = await findOrCreateThumbtackConversation({
    negotiationID: msg.negotiationID,
    customerName: msg.customerName,
  });

  // Address fields are display labels (no email/phone on this channel).
  const businessName = msg.businessName ?? 'NunezDev';
  const customerName = msg.customerName ?? 'Thumbtack customer';
  const fromAddress = msg.direction === 'inbound' ? customerName : businessName;
  const toAddress = msg.direction === 'inbound' ? businessName : customerName;

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    direction: msg.direction,
    channel: 'thumbtack',
    from_address: fromAddress,
    to_address: toAddress,
    body_text: msg.text,
    provider_id: msg.messageID, // unique index dedups redeliveries when present
    status: msg.direction === 'inbound' ? 'received' : 'sent',
  });

  // Duplicate delivery (unique provider_id) is success — already threaded. The
  // bump_conversation_on_message trigger maintains the conversation tail/unread.
  if (error && error.code !== '23505') {
    return { status: 'error', detail: error.message };
  }
  return { status: 'message_threaded', conversationId };
}
