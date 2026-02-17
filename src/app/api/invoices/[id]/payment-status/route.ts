import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    // Get invoice with payment details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        clients(name, email),
        invoice_payments(*)
      `)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Calculate payment summary
    const payments = invoice.invoice_payments || [];
    const totalPaid = payments.reduce((sum: number, payment: any) => sum + (payment.amount_cents || 0), 0);
    const remainingBalance = Math.max(0, invoice.amount_cents - totalPaid);
    
    // Determine detailed payment status
    let paymentStatus = 'unpaid';
    let paymentStatusDetail = 'No payments received';
    
    if (totalPaid === 0) {
      paymentStatus = 'unpaid';
      paymentStatusDetail = 'No payments received';
    } else if (totalPaid >= invoice.amount_cents) {
      paymentStatus = 'paid_in_full';
      paymentStatusDetail = 'Fully paid';
      if (totalPaid > invoice.amount_cents) {
        paymentStatusDetail = `Overpaid by $${((totalPaid - invoice.amount_cents) / 100).toFixed(2)}`;
      }
    } else {
      paymentStatus = 'partially_paid';
      const percentPaid = Math.round((totalPaid / invoice.amount_cents) * 100);
      paymentStatusDetail = `${percentPaid}% paid ($${(totalPaid / 100).toFixed(2)} of $${(invoice.amount_cents / 100).toFixed(2)})`;
    }

    // Group payments by method
    const paymentsByMethod = payments.reduce((acc: any, payment: any) => {
      const method = payment.payment_method || 'unknown';
      if (!acc[method]) {
        acc[method] = {
          method,
          count: 0,
          total_cents: 0,
          payments: []
        };
      }
      acc[method].count += 1;
      acc[method].total_cents += payment.amount_cents || 0;
      acc[method].payments.push(payment);
      return acc;
    }, {});

    const response = {
      invoice: {
        id: invoice.id,
        description: invoice.description,
        amount_cents: invoice.amount_cents,
        status: invoice.status,
        issued_at: invoice.issued_at,
        due_at: invoice.due_at,
        signed_at: invoice.signed_at,
        signer_name: invoice.signer_name,
        client: invoice.clients
      },
      payment_summary: {
        status: paymentStatus,
        status_detail: paymentStatusDetail,
        total_amount_cents: invoice.amount_cents,
        total_paid_cents: totalPaid,
        remaining_balance_cents: remainingBalance,
        payment_count: payments.length,
        is_signed: !!invoice.signed_at,
        is_overdue: invoice.due_at && new Date(invoice.due_at) < new Date() && remainingBalance > 0
      },
      payments_by_method: Object.values(paymentsByMethod),
      recent_payments: payments
        .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
        .slice(0, 5)
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Get payment status error:', error);
    return NextResponse.json({ 
      error: "Failed to get payment status" 
    }, { status: 500 });
  }
}