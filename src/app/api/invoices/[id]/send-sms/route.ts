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

  type ClientShape = { id: string; name: string | null; phone: string | null };
  const clientRaw = (invoice as { clients?: ClientShape | ClientShape[] | null }).clients;
  const client: ClientShape | null = Array.isArray(clientRaw)
    ? (clientRaw[0] ?? null)
    : (clientRaw ?? null);

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
