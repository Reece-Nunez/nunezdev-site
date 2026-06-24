/**
 * Send an invoice link to a phone number via Twilio SMS.
 *
 * Owner-only. Body:
 *   {
 *     to?: string;            // phone; falls back to client's stored phone
 *     bodyOverride?: string;  // custom message; falls back to default template
 *   }
 *
 * All the heavy lifting (phone normalization, rate limits, content guard,
 * activity logging) lives in src/lib/invoiceSms.ts so the same guarantees
 * apply when combine-and-send fires SMS too.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendInvoiceSmsWithGuards } from '@/lib/invoiceSms';
import { requestSmsConsent } from '@/lib/smsConsent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

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

  // Fetch invoice + client (org-scoped). Consent fields drive the
  // double-opt-in gate below.
  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      `id, invoice_number, amount_cents, access_token, status, org_id,
       clients!inner(id, name, phone, sms_consent, sms_opted_out_at)`
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

  type ClientShape = {
    id: string;
    name: string | null;
    phone: string | null;
    sms_consent: boolean | null;
    sms_opted_out_at: string | null;
  };
  const clientRaw = (invoice as { clients?: ClientShape | ClientShape[] | null }).clients;
  const client: ClientShape | null = Array.isArray(clientRaw)
    ? (clientRaw[0] ?? null)
    : (clientRaw ?? null);

  // Target phone: explicit `to` overrides the client's stored number.
  const targetPhone = (body.to ?? client?.phone ?? '').trim();

  // --- Double opt-in gate (TCPA / A2P 10DLC) -----------------------------
  // We never text an invoice to someone who hasn't agreed to texts.
  if (client?.sms_opted_out_at) {
    return NextResponse.json(
      {
        error:
          'This client opted out of texts (replied STOP). Reach them by email instead.',
      },
      { status: 409 }
    );
  }
  if (!client?.sms_consent) {
    // First contact: send the friendly "reply YES" request instead of the
    // invoice. Once they reply YES, consent is granted and a re-send goes
    // through. Surfaced to the operator so they know what happened.
    const consentReq = await requestSmsConsent({
      to: targetPhone,
      clientName: client?.name ?? null,
      clientId: client?.id ?? null,
    });
    if (!consentReq.ok) {
      return NextResponse.json({ error: consentReq.error }, { status: consentReq.status });
    }
    return NextResponse.json({
      ok: true,
      optInRequested: true,
      alreadyRequested: consentReq.alreadyRequested ?? false,
      to: consentReq.to,
    });
  }

  const result = await sendInvoiceSmsWithGuards({
    invoiceId: invoice.id,
    orgId: guard.orgId!,
    to: body.to,
    clientPhoneOnFile: client?.phone ?? null,
    bodyOverride: body.bodyOverride,
    clientName: client?.name ?? null,
    clientId: client?.id ?? null,
    invoiceNumber: invoice.invoice_number ?? null,
    amountCents: invoice.amount_cents,
    accessToken: invoice.access_token ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    sid: result.sid,
    to: result.to,
    messageLength: result.messageLength,
  });
}
