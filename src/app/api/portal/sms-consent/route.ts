/**
 * Client portal SMS-consent endpoint.
 *
 * GET  → returns the current consent state for the logged-in client.
 * POST → flips consent. Body: { consent: boolean }
 *
 * Auth: required portal session cookie. We never trust the client to
 * tell us *which* client they are — clientId is derived from the
 * signed session, not the request body.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPortalSessionFromCookie } from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getPortalSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('clients')
    .select('sms_consent, sms_consent_at, sms_opted_out_at, phone')
    .eq('id', session.clientId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  return NextResponse.json({
    consent: data.sms_consent ?? false,
    consentedAt: data.sms_consent_at,
    optedOutAt: data.sms_opted_out_at,
    hasPhone: !!data.phone,
    // Mask the phone for display — last 4 only.
    phoneLast4: data.phone ? String(data.phone).replace(/\D/g, '').slice(-4) : null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getPortalSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { consent?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const consent = Boolean(body.consent);

  // Capture IP for the audit trail — same approach as the contact form.
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  const supabase = supabaseAdmin();

  // If the client previously hit STOP via Twilio, they need to use START
  // (or this toggle) to clear the opt-out. Flipping consent on here ALSO
  // clears the opt-out, since the user is actively re-opting-in.
  const update = consent
    ? {
        sms_consent: true,
        sms_consent_at: new Date().toISOString(),
        sms_consent_ip: ip,
        sms_consent_source: 'portal_toggle',
        sms_opted_out_at: null,
      }
    : {
        // Turning the toggle off is treated as an opt-out from the
        // portal — set sms_opted_out_at so cron skips with the
        // appropriate reason, but keep sms_consent so we know they
        // historically opted in (audit trail).
        sms_opted_out_at: new Date().toISOString(),
      };

  const { error } = await supabase
    .from('clients')
    .update(update)
    .eq('id', session.clientId);

  if (error) {
    console.error('[portal/sms-consent] update failed:', error);
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
  }

  await supabase.from('client_activity_log').insert({
    client_id: session.clientId,
    activity_type: consent ? 'sms_opt_in' : 'sms_opt_out',
    activity_data: { source: 'portal_toggle' },
  });

  return NextResponse.json({ ok: true, consent });
}
