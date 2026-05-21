/**
 * Send an invoice link to a phone number via Twilio SMS.
 *
 * Owner-only. Body:
 *   {
 *     to?: string;        // phone number; falls back to client's stored phone
 *     bodyOverride?: string;  // custom message; falls back to default template
 *   }
 *
 * The default message keeps the SMS to a single segment (160 chars including
 * URL) when possible: "Hi [Name], your NunezDev invoice for $X is ready: URL".
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendSms, normalizePhoneE164 } from '@/lib/sms';
import { currency } from '@/lib/ui';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const FIRST_NAME = (full: string | null | undefined): string => {
  if (!full) return 'there';
  return full.split(/\s+/)[0] || 'there';
};

function defaultMessage(params: {
  clientName: string | null;
  amountCents: number;
  url: string;
}): string {
  const first = FIRST_NAME(params.clientName);
  return `Hi ${first}, your NunezDev invoice for ${currency(params.amountCents)} is ready: ${params.url}`;
}

export async function POST(req: Request, context: Ctx) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id: invoiceId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    bodyOverride?: string;
  };

  const supabase = supabaseAdmin();

  // Fetch invoice + client (org-scoped)
  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      `id, invoice_number, amount_cents, access_token, status, org_id,
       clients!inner(id, name, phone)`
    )
    .eq('id', invoiceId)
    .eq('org_id', guard.orgId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found or not in your org' },
      { status: 404 }
    );
  }

  // Supabase nests joins as array — normalize
  type ClientShape = { id: string; name: string | null; phone: string | null };
  const clientRaw = (invoice as { clients?: ClientShape | ClientShape[] | null }).clients;
  const client: ClientShape | null = Array.isArray(clientRaw)
    ? (clientRaw[0] ?? null)
    : (clientRaw ?? null);

  if (!invoice.access_token) {
    return NextResponse.json(
      { error: 'This invoice has no public link — cannot share via SMS' },
      { status: 400 }
    );
  }

  // Resolve target phone: explicit body.to overrides client.phone
  const rawPhone = (body.to ?? client?.phone ?? '').trim();
  if (!rawPhone) {
    return NextResponse.json(
      {
        error:
          'No phone number provided and no phone on file for this client. Add one to the client record or pass `to` in the request.',
      },
      { status: 400 }
    );
  }
  const phoneE164 = normalizePhoneE164(rawPhone);
  if (!phoneE164) {
    return NextResponse.json(
      { error: `Couldn't parse phone number: "${rawPhone}". Use a US format like (405) 555-1234.` },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
  const invoiceUrl = `${baseUrl}/invoice/${invoice.access_token}`;

  const message = body.bodyOverride?.trim()
    || defaultMessage({
      clientName: client?.name ?? null,
      amountCents: invoice.amount_cents,
      url: invoiceUrl,
    });

  // Hard cap to prevent runaway long messages — Twilio segments at 160 chars
  // and multi-segment SMS costs more. 800 chars (5 segments) is the ceiling.
  if (message.length > 800) {
    return NextResponse.json(
      { error: 'Message too long (max 800 characters)' },
      { status: 400 }
    );
  }

  // Content guard: the message MUST include the invoice URL. Prevents the
  // endpoint from being used as a general SMS gateway with our Twilio number
  // if a session ever gets misused.
  if (!message.includes(invoice.access_token)) {
    return NextResponse.json(
      { error: 'Message must include the invoice link.' },
      { status: 400 }
    );
  }

  // Rate limit + idempotency, both backed by client_activity_log entries we
  // write at the end of this handler. Same data source means no extra schema.
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // (a) Idempotency: same invoice + same target phone within last 60s = duplicate
  const { data: recentDupes } = await supabase
    .from('client_activity_log')
    .select('id, activity_data')
    .eq('invoice_id', invoice.id)
    .eq('activity_type', 'invoice_sms_sent')
    .gte('created_at', oneMinuteAgo)
    .limit(20);
  type SmsLogRow = { id: string; activity_data?: { to?: string } | null };
  if (
    (recentDupes as SmsLogRow[] | null)?.some(
      (r) => r.activity_data?.to === phoneE164
    )
  ) {
    return NextResponse.json(
      {
        error:
          'A text for this invoice was just sent to the same number. Wait a minute before retrying.',
      },
      { status: 429 }
    );
  }

  // (b) Per-invoice cap: max 5 SMS to ANY destination in the last hour
  const { count: hourlyCount } = await supabase
    .from('client_activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoice.id)
    .eq('activity_type', 'invoice_sms_sent')
    .gte('created_at', oneHourAgo);
  if ((hourlyCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Too many texts sent for this invoice in the last hour (max 5). Please wait.' },
      { status: 429 }
    );
  }

  // (c) Org-wide daily cap: catches runaway loops or compromised sessions.
  // Joined via invoices to constrain by org.
  const { count: dailyCount } = await supabase
    .from('client_activity_log')
    .select('id, invoice:invoices!inner(org_id)', { count: 'exact', head: true })
    .eq('activity_type', 'invoice_sms_sent')
    .eq('invoice.org_id', guard.orgId)
    .gte('created_at', oneDayAgo);
  if ((dailyCount ?? 0) >= 50) {
    return NextResponse.json(
      {
        error:
          'Daily SMS limit reached (50 messages in 24h). This is a safety cap — contact support if you need a higher limit.',
      },
      { status: 429 }
    );
  }

  const result = await sendSms({ to: phoneE164, body: message });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Failed to send SMS' },
      { status: 500 }
    );
  }

  // Log the send to the client activity stream so it shows up in the audit trail
  await supabase
    .from('client_activity_log')
    .insert({
      invoice_id: invoice.id,
      client_id: client?.id,
      activity_type: 'invoice_sms_sent',
      activity_data: {
        invoice_number: invoice.invoice_number,
        to: phoneE164,
        sid: result.sid,
        message_length: message.length,
      },
    })
    .then(({ error: logErr }) => {
      if (logErr) console.warn('[invoice-send-sms] activity log failed', logErr);
    });

  return NextResponse.json({
    ok: true,
    sid: result.sid,
    to: phoneE164,
    messageLength: message.length,
  });
}
