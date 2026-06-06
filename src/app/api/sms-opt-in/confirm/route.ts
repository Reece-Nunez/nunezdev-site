/**
 * One-shot SMS opt-in confirmation endpoint.
 *
 * POST { token } → validates the signed magic-link, records sms_consent
 * on the corresponding client, logs the opt-in. Public (the token IS
 * the auth — anyone who has it can opt in to their own SMS reminders).
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySmsOptInToken } from '@/lib/smsOptInToken';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const payload = await verifySmsOptInToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'This link is invalid or has expired. Ask Reece to send a new one, or opt in through the client portal.' },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('clients')
    .update({
      sms_consent: true,
      sms_consent_at: new Date().toISOString(),
      sms_consent_ip: ip,
      sms_consent_source: 'outreach_email',
      sms_opted_out_at: null,
    })
    .eq('id', payload.clientId);

  if (error) {
    console.error('[sms-opt-in/confirm] update failed:', error);
    return NextResponse.json({ error: 'Failed to opt in' }, { status: 500 });
  }

  await supabase.from('client_activity_log').insert({
    client_id: payload.clientId,
    activity_type: 'sms_opt_in',
    activity_data: { source: 'outreach_email' },
  });

  return NextResponse.json({ ok: true });
}
