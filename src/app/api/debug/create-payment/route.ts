import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuthedOrgId() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" as const } };

  const { data: m, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (error) return { ok: false as const, status: 400 as const, json: { error: error.message } };
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" as const } };

  return { ok: true as const, supabase, orgId, user };
}

export async function POST(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  try {
    const { invoice_number, amount_cents, payment_date } = await request.json();

    // Find the invoice
    const { data: invoice, error: invoiceError } = await gate.supabase
      .from('invoices')
      .select('id, amount_cents, client_id')
      .eq('invoice_number', invoice_number)
      .eq('org_id', gate.orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: `Invoice ${invoice_number} not found` }, { status: 404 });
    }

    // Check if payment already exists
    const { data: existingPayment } = await gate.supabase
      .from('invoice_payments')
      .select('id')
      .eq('invoice_id', invoice.id)
      .single();

    if (existingPayment) {
      return NextResponse.json({ error: `Payment already exists for invoice ${invoice_number}` }, { status: 400 });
    }

    // Create payment record
    const paymentData = {
      invoice_id: invoice.id,
      amount_cents: amount_cents || invoice.amount_cents,
      paid_at: payment_date ? new Date(payment_date).toISOString() : new Date().toISOString(),
      payment_method: 'hubspot',
      metadata: {
        source: 'manual_debug',
        created_by: 'debug_endpoint',
        invoice_number
      }
    };

    const { data: newPayment, error: paymentError } = await gate.supabase
      .from('invoice_payments')
      .insert(paymentData)
      .select('*')
      .single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      payment: newPayment,
      invoice_id: invoice.id,
      message: `Payment created for invoice ${invoice_number}`
    });

  } catch (error: unknown) {
    console.error("Create payment error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}