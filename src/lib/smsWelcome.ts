/**
 * Friendly, A2P-10DLC-compliant SMS copy for the consent lifecycle.
 *
 * Three moments:
 *   1. buildOptInRequestSms  — the FIRST text to someone with no consent on
 *      file. Asks them to reply YES. (Sent by requestSmsConsent.)
 *   2. buildWelcomeSms       — the confirmation once they're opted in (via the
 *      contact form box, the portal toggle, OR replying YES). Reused as the
 *      single "you're in" message everywhere so the voice stays consistent.
 *
 * Every message names the brand, says what they get, notes frequency + that
 * rates may apply, and carries the STOP / HELP keywords carriers require.
 * Tone is intentionally warm — these are the only texts some clients ever get
 * from us, so they should feel human, not like a compliance robot.
 *
 * Pure builders (no Twilio/db import) so they're unit-testable and safe to
 * reuse from the inbound webhook's TwiML reply path.
 */

/** First name only, trimmed. Empty string when we have nothing usable. */
function firstName(name?: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * One-time "can we text you?" request. Sent before we ever message a contact
 * who hasn't consented — their YES reply becomes the opt-in.
 */
export function buildOptInRequestSms(opts: { name?: string | null }): string {
  const first = firstName(opts.name);
  const hey = first ? `Hey ${first}!` : `Hey!`;
  return (
    `${hey} 👋 It's NunezDev. Mind if we text you invoices, quotes & project ` +
    `updates? Reply YES and you're all set. Msg frequency varies, msg & data ` +
    `rates may apply. Reply STOP to opt out, HELP for help.`
  );
}

/**
 * "You're in" confirmation. Fires the moment consent is granted on any
 * surface (form checkbox, portal toggle, or a YES reply).
 */
export function buildWelcomeSms(opts: { name?: string | null }): string {
  const first = firstName(opts.name);
  const lead = first ? `You're in, ${first}!` : `You're in!`;
  return (
    `${lead} 🎉 NunezDev will text you project updates, quotes & invoice ` +
    `reminders here. Msg frequency varies, msg & data rates may apply. ` +
    `Reply STOP to opt out, HELP for help.`
  );
}
