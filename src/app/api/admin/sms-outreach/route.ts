/**
 * One-time SMS opt-in outreach.
 *
 * POST /api/admin/sms-outreach
 *   Headers: Authorization: Bearer <CRON_SECRET>
 *   Body (optional): { dryRun?: boolean, clientIds?: string[] }
 *
 * Emails every eligible client a signed magic-link to opt in. "Eligible"
 * means: has email, has phone, sms_consent is currently false, not yet
 * opted out. dryRun=true returns who *would* be emailed without sending.
 *
 * Safe to call multiple times — the underlying clients table tracks
 * sms_consent, so a client who already opted in won't be re-emailed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { signSmsOptInToken } from '@/lib/smsOptInToken';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nunezdev.com';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { dryRun?: boolean; clientIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional; ignore parse errors
  }
  const dryRun = Boolean(body.dryRun);

  const supabase = supabaseAdmin();
  let query = supabase
    .from('clients')
    .select('id, name, email, phone')
    .eq('sms_consent', false)
    .is('sms_opted_out_at', null)
    .not('email', 'is', null)
    .not('phone', 'is', null);
  if (body.clientIds?.length) {
    query = query.in('id', body.clientIds);
  }
  const { data: clients, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!clients?.length) {
    return NextResponse.json({ message: 'No eligible clients.', sent: 0 });
  }

  // Filter again client-side for empty-string phone/email — Postgres
  // .not('is', null) doesn't catch '' values.
  const eligible = clients.filter(
    c => (c.email ?? '').trim() && (c.phone ?? '').trim(),
  );

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      eligible_count: eligible.length,
      eligible: eligible.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phoneLast4: String(c.phone).replace(/\D/g, '').slice(-4),
      })),
    });
  }

  let sent = 0;
  const failed: { id: string; reason: string }[] = [];

  for (const client of eligible) {
    try {
      const token = await signSmsOptInToken(client.id);
      const link = `${BASE_URL}/sms-opt-in/${token}`;
      const firstName = (client.name ?? '').split(' ')[0] || 'there';

      await resend.emails.send({
        from: 'Reece at NunezDev <reece@nunezdev.com>',
        to: [client.email as string],
        subject: 'Want text reminders when your invoice is due?',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
            <h1 style="color: #ffc312; margin-bottom: 8px;">Quick question, ${firstName}</h1>
            <p>Would you like a text the morning an invoice is due? I'm rolling out optional SMS reminders for clients who'd find it easier than email.</p>
            <p><strong>You're in control:</strong></p>
            <ul style="padding-left: 20px;">
              <li>One text per due date. No marketing, no nagging.</li>
              <li>Reply <strong>STOP</strong> to any message to opt out at any time.</li>
              <li>Standard message/data rates apply.</li>
            </ul>
            <div style="margin: 28px 0;">
              <a href="${link}"
                 style="display: inline-block; background-color: #ffc312; color: #1a1a1a; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-size: 15px;">
                Yes, text me reminders &rarr;
              </a>
            </div>
            <p style="font-size: 12px; color: #888;">
              If the button doesn't work, paste this link into your browser:<br/>
              <a href="${link}">${link}</a>
            </p>
            <p style="font-size: 12px; color: #888; margin-top: 18px;">
              Prefer not to? Just ignore this email — you'll keep getting email invoice notifications same as before. The opt-in link expires in 30 days.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0;" />
            <p style="font-size: 11px; color: #aaa;">
              By clicking the button above, you agree to receive transactional SMS messages from NunezDev about your invoices, projects, and account. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. See our
              <a href="${BASE_URL}/sms-terms" style="color: #888;">SMS Terms</a> and
              <a href="${BASE_URL}/privacy-policy" style="color: #888;">Privacy Policy</a>.
            </p>
          </div>
        `,
      });
      sent += 1;
    } catch (err: unknown) {
      failed.push({
        id: client.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ sent, failed_count: failed.length, failed });
}
