import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

type Ctx = { params: Promise<{ id: string }> };

// Get payment plans for an invoice
export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  
  const { id: invoiceId } = await ctx.params;
  const supabase = await supabaseServer();

  try {
    // Verify invoice belongs to org
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, org_id, payment_plan_enabled")
      .eq("id", invoiceId)  
      .eq("org_id", orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get payment plan installments
    const { data: installments, error: installmentsError } = await supabase
      .from("invoice_payment_plans")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("installment_number");

    if (installmentsError) {
      return NextResponse.json({ error: installmentsError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      invoice_id: invoiceId,
      payment_plan_enabled: invoice.payment_plan_enabled,
      installments: installments || []
    });
  } catch (error) {
    console.error("Error fetching payment plans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Create Stripe payment links for payment plan installments
export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  
  const { id: invoiceId } = await ctx.params;
  const supabase = await supabaseServer();

  try {
    // Get invoice and installments
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id, org_id, invoice_number, access_token,
        clients!inner(name, email)
      `)
      .eq("id", invoiceId)  
      .eq("org_id", orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: installments, error: installmentsError } = await supabase
      .from("invoice_payment_plans")
      .select("*")
      .eq("invoice_id", invoiceId)
      .is("stripe_payment_link_id", null)
      .order("installment_number");

    if (installmentsError) {
      return NextResponse.json({ error: installmentsError.message }, { status: 500 });
    }

    if (!installments || installments.length === 0) {
      return NextResponse.json({ message: "No installments need payment links" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const createdLinks = [];

    // Create Stripe payment links for each installment
    for (const installment of installments) {
      try {
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${invoice.invoice_number} - ${installment.installment_label}`,
                  description: `Payment for ${(invoice.clients as any)?.name || 'client'}`
                },
                unit_amount: installment.amount_cents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            invoice_id: invoiceId,
            installment_id: installment.id,
            client_id: invoice.client_id,
            org_id: orgId,
            invoice_number: invoice.invoice_number || '',
            client_email: (invoice.clients as any)?.email || '',
            client_name: (invoice.clients as any)?.name || '',
            amount_cents: installment.amount_cents.toString(),
            source: 'stripe_payment_link',
            installment_label: installment.installment_label,
            installment_number: installment.installment_number.toString(),
            created_at: new Date().toISOString()
          },
          after_completion: {
            type: 'redirect',
            redirect: {
              url: `${process.env.NEXT_PUBLIC_BASE_URL}/invoice/${invoice.access_token}?payment=success`
            }
          }
        });

        // Update installment with Stripe payment link
        await supabase
          .from("invoice_payment_plans")
          .update({
            stripe_payment_link_id: paymentLink.id,
            stripe_payment_link_url: paymentLink.url
          })
          .eq("id", installment.id);

        createdLinks.push({
          installment_id: installment.id,
          installment_label: installment.installment_label,
          amount_cents: installment.amount_cents,
          payment_link_url: paymentLink.url
        });
      } catch (stripeError) {
        console.error(`Error creating payment link for installment ${installment.id}:`, stripeError);
      }
    }

    return NextResponse.json({ 
      message: "Payment links created",
      links: createdLinks 
    });
  } catch (error) {
    console.error("Error creating payment links:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}