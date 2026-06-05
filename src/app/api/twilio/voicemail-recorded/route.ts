/**
 * Twilio fires this webhook the moment the caller finishes recording a
 * voicemail (i.e. presses #, hits the max length, or hangs up).
 *
 * Payload (form-encoded, parsed by verifyTwilioWebhook):
 *   - From            caller's E.164 number
 *   - To              your Twilio number
 *   - CallSid         the originating call SID
 *   - RecordingSid    voicemail recording SID
 *   - RecordingUrl    base recording URL (no extension — append .mp3)
 *   - RecordingDuration  seconds, as a string
 *
 * Transcription arrives asynchronously (transcribe="true" on <Record>);
 * Twilio will POST a separate transcription callback if you wire one,
 * but for v1 we just include the recording URL and Reece can view the
 * transcript in the Twilio Console when it's ready.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { verifyTwilioWebhook } from '@/lib/twilioWebhook';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);
const NOTIFY_EMAIL = process.env.VOICEMAIL_NOTIFY_EMAIL ?? 'reece@nunezdev.com';

export async function POST(request: NextRequest) {
  const verdict = await verifyTwilioWebhook(request);
  if (!verdict.ok) {
    console.warn('[twilio/voicemail-recorded] signature check failed:', verdict.reason);
    return new NextResponse('Forbidden', { status: 403 });
  }

  const {
    From: from,
    To: to,
    CallSid: callSid,
    RecordingSid: recordingSid,
    RecordingUrl: recordingUrl,
    RecordingDuration: recordingDuration,
  } = verdict.params;

  // Append .mp3 — Twilio's RecordingUrl is extensionless and the bare
  // URL returns a WAV by default. MP3 is smaller and email-friendlier.
  const mp3Url = recordingUrl ? `${recordingUrl}.mp3` : null;

  try {
    await resend.emails.send({
      from: 'NunezDev Voicemail <reece@nunezdev.com>',
      to: [NOTIFY_EMAIL],
      subject: `New voicemail from ${from ?? 'unknown'}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ffc312; margin-bottom: 8px;">New voicemail</h1>
          <p style="color: #666; margin-top: 0; font-size: 14px;">
            Someone left a message on your business line. Transcription will be available in the Twilio Console once it finishes processing.
          </p>

          <div style="background-color: #f8f9fa; border-radius: 6px; padding: 18px; margin: 20px 0;">
            <p><strong>From:</strong> ${from ?? 'Unknown'}</p>
            <p><strong>To:</strong> ${to ?? '—'}</p>
            <p><strong>Length:</strong> ${recordingDuration ?? '?'} sec</p>
            <p><strong>Recording SID:</strong> ${recordingSid ?? '—'}</p>
            <p><strong>Call SID:</strong> ${callSid ?? '—'}</p>
          </div>

          ${
            mp3Url
              ? `<div style="margin: 24px 0;">
                  <a href="${mp3Url}"
                     style="display: inline-block; background-color: #ffc312; color: #1a1a1a; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-size: 15px;">
                    Listen to recording &rarr;
                  </a>
                </div>
                <p style="font-size: 12px; color: #888;">
                  Direct link: <a href="${mp3Url}">${mp3Url}</a>
                </p>`
              : `<p style="color: #b00;">No recording URL was provided by Twilio. Check the Console.</p>`
          }
        </div>
      `,
    });
  } catch (err: unknown) {
    // We still ACK the webhook so Twilio doesn't retry endlessly — the
    // recording is safe in Twilio storage and Reece can pull it from the
    // Console. Log loudly so we can debug Resend issues.
    console.error('[twilio/voicemail-recorded] failed to email notification', err);
  }

  // Twilio expects 200 + empty TwiML to end the call gracefully after
  // the recording is captured. Anything else may cause an extra Say
  // verb to play or a retry.
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
  );
}
