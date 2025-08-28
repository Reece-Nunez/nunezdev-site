import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ token: string }> };

// Public endpoint to get payment plans for an invoice via access token
export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const supabase = await supabaseServer();

  try {
    // Get invoice by access token (public access)
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, org_id, payment_plan_enabled")
      .eq("access_token", token)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get payment plan installments
    const { data: installments, error: installmentsError } = await supabase
      .from("invoice_payment_plans")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("installment_number");

    if (installmentsError) {
      return NextResponse.json({ error: installmentsError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      invoice_id: invoice.id,
      payment_plan_enabled: invoice.payment_plan_enabled,
      installments: installments || []
    });
  } catch (error) {
    console.error("Error fetching public payment plans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}