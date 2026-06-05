/**
 * Incoming-call webhook for the NunezDev Twilio number.
 *
 * Flow:
 *   1. <Dial> the forward target (Reece's cell) with a 15s timeout —
 *      shorter than the cell's own voicemail so Twilio voicemail takes
 *      over instead of the carrier's. `answerOnBridge` keeps the caller
 *      on ringing tones until the cell actually picks up (otherwise
 *      Twilio "answers" immediately and the caller hears silence).
 *   2. If the dial doesn't connect (no answer / busy / cell rejects),
 *      TwiML execution falls through to the next verbs, which play a
 *      voicemail greeting and record up to 2 minutes. The recording
 *      webhook (/voicemail-recorded) emails Reece the recording URL.
 *
 * Notes:
 *   - When the caller hangs up the <Dial> mid-connect, Twilio aborts
 *     remaining TwiML so the voicemail doesn't play. That's correct
 *     behavior — only no-answer scenarios reach the Record verb.
 *   - We deliberately don't set `callerId` on <Dial>; the default passes
 *     the original caller's number to your cell so caller-ID is honest.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioWebhook } from '@/lib/twilioWebhook';

// Force Node runtime — the twilio SDK uses Node APIs.
export const runtime = 'nodejs';

const FORWARD_TO = process.env.VOICE_FORWARD_TO;

export async function POST(request: NextRequest) {
  const verdict = await verifyTwilioWebhook(request);
  if (!verdict.ok) {
    console.warn('[twilio/voice-incoming] signature check failed:', verdict.reason);
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!FORWARD_TO) {
    // Misconfiguration — don't drop the call silently. Play a polite
    // error message so the caller hears something instead of a click.
    return twimlResponse(
      `<Response>
        <Say voice="Polly.Joanna">We're sorry, our phone system is temporarily misconfigured. Please email reece at nunezdev dot com instead.</Say>
        <Hangup/>
      </Response>`,
    );
  }

  // Build the absolute URL Twilio should POST the recording to. Twilio
  // resolves relative action URLs against the request URL, but we want
  // www.nunezdev.com regardless of where this route is hit (preview
  // deploys, etc.) so the recording webhook always lands on prod.
  const recordingActionUrl = 'https://www.nunezdev.com/api/twilio/voicemail-recorded';

  // 15s is short enough to beat most carrier voicemails (which kick in
  // around 20-25s) but long enough to ring the cell 3-4 times. Tweak if
  // you want to give yourself more time to answer.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="15" answerOnBridge="true">
    <Number>${FORWARD_TO}</Number>
  </Dial>
  <Say voice="Polly.Joanna">You've reached NunezDev. Please leave a brief message after the tone, and press pound when you're finished.</Say>
  <Record
    maxLength="120"
    action="${recordingActionUrl}"
    transcribe="true"
    finishOnKey="#"
    playBeep="true"
  />
  <Say voice="Polly.Joanna">Thanks, talk soon.</Say>
  <Hangup/>
</Response>`;

  return twimlResponse(twiml);
}

function twimlResponse(twiml: string): NextResponse {
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}
