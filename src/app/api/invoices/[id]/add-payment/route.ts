import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { 
    amount_cents, 
    payment_method, 
    paid_at, 
    stripe_payment_intent_id,
    stripe_charge_id,
    notes 
  } = await req.json();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    // Verify the invoice belongs to the user's org and get current status
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, amount_cents, total_paid_cents, status")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Validate required fields
    if (!amount_cents || amount_cents <= 0) {
      return NextResponse.json({ error: "Valid payment amount required" }, { status: 400 });
    }

    // Add the payment record
    const { data: payment, error } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: id,
        amount_cents,
        payment_method: payment_method || 'manual',
        paid_at: paid_at || new Date().toISOString(),
        stripe_payment_intent_id: stripe_payment_intent_id || null,
        stripe_charge_id: stripe_charge_id || null,
        metadata: notes ? { notes } : null
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get updated invoice status (will be updated by trigger)
    const { data: updatedInvoice } = await supabase
      .from("invoices")
      .select("status, total_paid_cents, remaining_balance_cents")
      .eq("id", id)
      .single();

    return NextResponse.json({ 
      success: true, 
      message: "Payment added successfully",
      payment,
      updatedInvoiceStatus: updatedInvoice
    });

  } catch (error) {
    console.error('Add payment error:', error);
    return NextResponse.json({ 
      error: "Failed to add payment" 
    }, { status: 500 });
  }
}

// Get all payments for an invoice
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    // Verify access and get payments
    const { data: payments, error } = await supabase
      .from("invoice_payments")
      .select(`
        *,
        invoice:invoices!inner(id, org_id)
      `)
      .eq("invoice_id", id)
      .eq("invoice.org_id", orgId)
      .order("paid_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ payments });

  } catch (error) {
    console.error('Get payments error:', error);
    return NextResponse.json({ 
      error: "Failed to get payments" 
    }, { status: 500 });
  }
}