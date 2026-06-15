/**
 * Pure email-threading helpers for the inbox — no DB, no env-dependent
 * singletons, no `@/` alias imports — so they can be unit-tested in isolation
 * under the tsx test runner (which doesn't resolve path aliases). The
 * stateful inbox logic in inbox.ts re-exports these.
 */

/** Subdomain whose MX points at Resend Inbound (Phase 4). Overridable via env
 *  so staging/preview can use a different domain without a code change. */
export const INBOX_REPLY_DOMAIN =
  process.env.INBOX_REPLY_DOMAIN ?? 'reply.nunezdev.com';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Threading Reply-To for an email conversation:
 *   <conversation_id>@reply.nunezdev.com
 * Inbound replies land here; parseConversationIdFromAddress() reverses it.
 */
export function buildReplyToAddress(conversationId: string): string {
  return `${conversationId}@${INBOX_REPLY_DOMAIN}`;
}

/**
 * Reverse of buildReplyToAddress. Accepts a bare "id@domain" or a
 * "Display Name <id@domain>" form. Returns the conversation id only when the
 * local part is a valid UUID and the domain matches our reply domain;
 * otherwise null (so a stray To/Cc address can't hijack a thread).
 */
export function parseConversationIdFromAddress(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const angle = address.match(/<([^>]+)>/);
  const raw = (angle ? angle[1] : address).trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at === -1) return null;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (domain !== INBOX_REPLY_DOMAIN.toLowerCase()) return null;
  return UUID_RE.test(local) ? local : null;
}
