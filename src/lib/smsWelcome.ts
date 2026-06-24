/**
 * Builds the one-time opt-in confirmation ("welcome") SMS that fires the
 * moment a contact actively checks the service-SMS consent box.
 *
 * CTIA best practice — and what several carriers now expect for A2P 10DLC —
 * is an immediate confirmation message that:
 *   - names the brand (NunezDev),
 *   - states what they opted into (service / transactional messages),
 *   - notes message frequency + that rates may apply,
 *   - includes the STOP / HELP keywords.
 *
 * Kept as a pure builder (no Twilio import) so it can be unit-tested and
 * reused by both opt-in surfaces: the public contact form and the client
 * portal consent toggle.
 */
export function buildWelcomeSms(opts: { name?: string | null }): string {
  // Greet by first name when we have one — keep it personal but never break
  // if the name is blank/garbage.
  const first = (opts.name ?? '').trim().split(/\s+/)[0];
  const greeting = first ? `Hi ${first}, you're` : `You're`;

  return (
    `${greeting} opted in to service texts from NunezDev ` +
    `(project updates, quotes & invoice reminders). ` +
    `Msg frequency varies, msg & data rates may apply. ` +
    `Reply STOP to opt out, HELP for help.`
  );
}
