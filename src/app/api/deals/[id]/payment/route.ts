import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: dealId } = await ctx.params;
    const { 
      invoice_id,
      amount_cents, 
      payment_method = "Manual",
      notes,
      paid_at
    } = await req.json();
    
    const supabase = await supabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = memberships?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    // Get the deal and its associated invoices
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(`
        id,
        title,
        value_cents,
        stage,
        client_id,
        invoices:invoices!client_id (
          id,
          amount_cents,
          status,
          invoice_payments (
            amount_cents
          )
        )
      `)
      .eq("id", dealId)
      .eq("org_id", orgId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // If no specific invoice_id provided, try to find a suitable invoice or create one
    let targetInvoiceId = invoice_id;
    
    if (!targetInvoiceId) {
      // Look for an unpaid invoice
      const unpaidInvoice = deal.invoices?.find(inv => inv.status !== 'paid');
      
      if (unpaidInvoice) {
        targetInvoiceId = unpaidInvoice.id;
      } else {
        // Create a new invoice for this payment
        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            org_id: orgId,
            client_id: deal.client_id,
            status: "sent",
            amount_cents: amount_cents,
            description: `Payment for ${deal.title}`,
            issued_at: new Date().toISOString(),
            due_at: new Date().toISOString(),
            source: "deal_payment"
          })
          .select("id")
          .single();
          
        if (invoiceError) {
          return NextResponse.json({ error: "Failed to create invoice for payment" }, { status: 400 });
        }
        
        targetInvoiceId = newInvoice.id;
      }
    }

    // Add the payment
    const { data: payment, error: paymentError } = await supabase
      .from("invoice_payments")
      .insert({
        org_id: orgId,
        invoice_id: targetInvoiceId,
        amount_cents,
        payment_method,
        notes,
        paid_at: paid_at || new Date().toISOString(),
        source: "manual"
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    // Check if we should auto-update the deal stage
    // Get updated financial totals for the deal
    const { data: updatedDeal } = await supabase
      .from("deals")
      .select(`
        id,
        value_cents,
        stage,
        invoices:invoices!client_id (
          amount_cents,
          status,
          invoice_payments (
            amount_cents
          )
        )
      `)
      .eq("id", dealId)
      .eq("org_id", orgId)
      .single();

    if (updatedDeal) {
      // Calculate total paid vs deal value
      let totalInvoiced = 0;
      let totalPaid = 0;
      
      updatedDeal.invoices?.forEach(invoice => {
        if (invoice.status !== 'draft') {
          totalInvoiced += invoice.amount_cents || 0;
        }
        invoice.invoice_payments?.forEach(payment => {
          totalPaid += payment.amount_cents || 0;
        });
      });

      // Auto-update stage if fully paid and not already Won/Lost/Abandoned
      const shouldMarkWon = totalPaid >= updatedDeal.value_cents && 
                           !['Won', 'Lost', 'Abandoned'].includes(updatedDeal.stage);
      
      if (shouldMarkWon) {
        await supabase
          .from("deals")
          .update({ 
            stage: "Won",
            updated_at: new Date().toISOString()
          })
          .eq("id", dealId)
          .eq("org_id", orgId);
      }
      
      // Also update invoice status if fully paid
      const { data: invoice } = await supabase
        .from("invoices")
        .select(`
          id,
          amount_cents,
          invoice_payments (
            amount_cents
          )
        `)
        .eq("id", targetInvoiceId)
        .single();

      if (invoice) {
        const invoicePaid = invoice.invoice_payments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;
        if (invoicePaid >= (invoice.amount_cents || 0)) {
          await supabase
            .from("invoices")
            .update({ status: "paid" })
            .eq("id", targetInvoiceId);
        }
      }
    }

    return NextResponse.json({ 
      payment,
      message: "Payment added successfully",
      auto_updated_stage: updatedDeal?.stage === "Won" ? "Deal marked as Won" : null
    });

  } catch (error: unknown) {
    console.error("Failed to add manual payment:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}