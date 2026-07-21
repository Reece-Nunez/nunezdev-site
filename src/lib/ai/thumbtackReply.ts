/**
 * Drafting a first reply to a Thumbtack lead. Pure prompt + sanitizer; wired to
 * the Anthropic client by the /leads/[id]/draft-reply route (manual send) and by
 * thumbtackAutoReply.ts (instant auto-send over the Thumbtack messaging API).
 *
 * Keep it short, sounding like Reece, and free of em dashes: it may go out over
 * SMS or as a Thumbtack message, and the short SMS-friendly shape suits both.
 */

export const THUMBTACK_REPLY_SYSTEM_PROMPT = `You write Reece's first reply to a new lead who reached out through Thumbtack for web design or development work. Reece runs NunezDev, a small web studio.

GOAL
- Acknowledge what they asked about, sound genuinely interested, and move toward a quick call. Keep it easy for them to say yes.

VOICE
- Warm, direct, and human. Like a real person texting back, not a sales script.
- First person ("I"). No corporate filler, no buzzwords.
- NEVER use em dashes or en dashes (— or –). Use periods or commas.
- This is an SMS, so keep it short: 2 to 4 sentences, well under 480 characters. No greeting line like "Dear ...", just start talking.
- End with a simple call to action (a quick call, or asking for a good time).

OUTPUT
Respond with ONLY the message text. No quotes, no preamble, no signature block.`;

export function buildReplyUserPrompt(params: {
  leadName?: string | null;
  projectType?: string | null;
  theirMessage?: string | null;
}): string {
  const lines: string[] = [];
  if (params.leadName) lines.push(`Lead name: ${params.leadName}`);
  if (params.projectType) lines.push(`What they want: ${params.projectType}`);
  if (params.theirMessage) lines.push(`Their message: "${params.theirMessage}"`);
  if (lines.length === 0) lines.push('A new Thumbtack lead about web design. No other details yet.');
  return `Write Reece's reply to this lead:\n\n${lines.join('\n')}`;
}

/**
 * Final safety net on the model output: strip any em/en dashes that slipped
 * through, collapse whitespace, and cap length so it stays SMS-friendly.
 */
export function sanitizeReply(text: string): string {
  return text
    .replace(/^["'`\s]+|["'`\s]+$/g, '') // strip wrapping quotes/whitespace
    .replace(/\s*[—–]\s*/g, ', ') // belt-and-suspenders: no em/en dashes
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 600);
}
