/**
 * Owner-only diagnostic — reports which Twilio env vars are detected
 * (by name) and whether overall config is valid. Never returns the
 * actual SID / token / secret values; only:
 *   - which env var name supplied each piece
 *   - the last 4 digits of the from number (so the operator can confirm
 *     it's the right phone)
 *
 * Useful when "SMS isn't working" — paste the response and we can see
 * exactly what's missing without you sharing secrets.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { getTwilioConfigSummary } from '@/lib/sms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const summary = getTwilioConfigSummary();

  return NextResponse.json(
    {
      ok: summary.ok,
      detected: {
        accountSid: summary.accountSidSource,
        auth: summary.authSource,
        fromNumber: summary.fromNumberSource,
      },
      fromNumberLast4: summary.fromNumberHint,
      hint: summary.ok
        ? 'Twilio is configured. If SMS still fails, the error from /send-sms will tell you why (likely an A2P 10DLC registration or balance issue).'
        : 'Twilio is NOT fully configured — add the missing env vars in Vercel and redeploy.',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
