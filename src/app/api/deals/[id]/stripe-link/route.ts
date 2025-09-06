import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-07-30.basil",
  });
  
  try {
    const { id: dealId } = await ctx.params;
    const { amount_cents, description, success_url, cancel_url } = await req.json();
    const supabase = await supabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = memberships?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    // Get the deal and client information
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(`
        id,
        title,
        value_cents,
        client:client_id (
          id,
          name,
          email
        )
      `)
      .eq("id", dealId)
      .eq("org_id", orgId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (!(deal.client as any)?.email) {
      return NextResponse.json({ error: "Client must have an email to create payment link" }, { status: 400 });
    }

    // Create or retrieve Stripe customer
    let customer;
    try {
      // First, try to find existing customer by email
      const customers = await stripe.customers.list({
        email: (deal.client as any).email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email: (deal.client as any).email,
          name: (deal.client as any).name,
          metadata: {
            client_id: (deal.client as any).id,
            org_id: orgId,
          },
        });
      }
    } catch (error) {
      console.error("Error creating/finding Stripe customer:", error);
      return NextResponse.json({ error: "Failed to create Stripe customer" }, { status: 500 });
    }

    // Create the payment link
    try {
      const paymentAmount = amount_cents || deal.value_cents;
      const paymentDescription = description || `Payment for ${deal.title}`;

      // Create an invoice record first so we can include its ID in the payment link metadata
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          org_id: orgId,
          client_id: (deal.client as any).id,
          status: "sent",
          amount_cents: paymentAmount,
          description: paymentDescription,
          issued_at: new Date().toISOString(),
          due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          source: "stripe_payment_link"
        })
        .select()
        .single();

      if (invoiceError) {
        console.error("Failed to create invoice record:", invoiceError);
        return NextResponse.json({ error: "Failed to create invoice record" }, { status: 500 });
      }

      const paymentLink = await stripe.paymentLinks.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: paymentDescription,
                description: `Deal: ${deal.title}`,
              },
              unit_amount: paymentAmount,
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoice_id: invoice.id,
          deal_id: dealId,
          client_id: deal.client_id,
          org_id: orgId,
          invoice_number: invoice.invoice_number || '',
          client_email: (deal.clients as any)?.email || '',
          client_name: (deal.clients as any)?.name || '',
          amount_cents: paymentAmount.toString(),
          source: 'stripe_payment_link',
          deal_title: deal.title,
          created_at: new Date().toISOString()
        },
        after_completion: {
          type: "redirect",
          redirect: {
            url: success_url || `${process.env.NEXTAUTH_URL}/deals/${dealId}?payment=success`,
          },
        },
        metadata: {
          deal_id: dealId,
          client_id: (deal.client as any).id,
          org_id: orgId,
          invoice_id: invoice.id, // This is the key fix!
          type: "deal_payment",
        },
        customer_creation: "always",
        allow_promotion_codes: true,
      });

      // Update the invoice with the payment link URL and Stripe payment link ID
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          external_url: paymentLink.url,
          stripe_invoice_id: paymentLink.id
        })
        .eq("id", invoice.id);

      if (updateError) {
        console.error("Failed to update invoice with payment link:", updateError);
        // Don't fail the request, just log the error
      }

      return NextResponse.json({
        payment_link: paymentLink.url,
        stripe_payment_link_id: paymentLink.id,
        customer_id: customer.id,
        invoice_id: invoice.id,
        message: "Stripe payment link created successfully"
      });

    } catch (error) {
      console.error("Error creating Stripe payment link:", error);
      return NextResponse.json({ 
        error: "Failed to create payment link", 
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error("Failed to create Stripe payment link:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}