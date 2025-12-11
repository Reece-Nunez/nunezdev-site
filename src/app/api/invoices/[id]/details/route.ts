import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  
  const { id: invoiceId } = await context.params;
  const supabase = await supabaseServer();

  try {
    // Fetch invoice with client details, payments, and payment plans
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        *,
        clients!inner(
          id,
          name,
          email,
          phone,
          company
        ),
        invoice_payments(
          id,
          amount_cents,
          payment_method,
          paid_at
        ),
        invoice_payment_plans(
          id,
          installment_number,
          amount_cents,
          due_at,
          status,
          paid_at
        )
      `)
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice details:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}