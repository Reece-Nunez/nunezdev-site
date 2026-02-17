import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

type Ctx = { params: Promise<{ id: string }> };

// Calculate installment amounts based on plan type
function calculateInstallmentAmounts(totalCents: number, planType: string, installmentCount: number): number[] {
  switch (planType) {
    case '50_50':
      const half = Math.round(totalCents / 2);
      return [half, totalCents - half];
    case '40_30_30':
      const first = Math.round(totalCents * 0.4);
      const second = Math.round(totalCents * 0.3);
      const third = totalCents - first - second;
      return [first, second, third];
    case 'custom':
      const perInstallment = Math.round(totalCents / installmentCount);
      const amounts = Array(installmentCount).fill(perInstallment);
      amounts[amounts.length - 1] = totalCents - (perInstallment * (installmentCount - 1));
      return amounts;
    default:
      return [totalCents];
  }
}

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
        id, org_id, invoice_number, access_token, client_id,
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

// Recalculate payment plan amounts based on current invoice total
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { id: invoiceId } = await ctx.params;
  const supabase = await supabaseServer();

  try {
    // Get invoice with current total
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id, org_id, amount_cents, payment_plan_type, invoice_number, access_token, client_id,
        clients!inner(name, email)
      `)
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get existing installments
    const { data: installments, error: installmentsError } = await supabase
      .from("invoice_payment_plans")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("installment_number");

    if (installmentsError || !installments || installments.length === 0) {
      return NextResponse.json({ error: "No payment plan installments found" }, { status: 404 });
    }

    // Calculate new amounts based on current invoice total
    const newAmounts = calculateInstallmentAmounts(
      invoice.amount_cents,
      invoice.payment_plan_type,
      installments.length
    );

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const updatedInstallments = [];

    // Update each installment
    for (let i = 0; i < installments.length; i++) {
      const installment = installments[i];
      const newAmount = newAmounts[i];

      // Archive old Stripe payment link if exists
      if (installment.stripe_payment_link_id) {
        try {
          await stripe.paymentLinks.update(installment.stripe_payment_link_id, {
            active: false
          });
        } catch (stripeErr) {
          console.error(`Failed to archive payment link ${installment.stripe_payment_link_id}:`, stripeErr);
        }
      }

      // Create new Stripe payment link with correct amount
      let newPaymentLinkId = null;
      let newPaymentLinkUrl = null;

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
                unit_amount: newAmount,
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
            amount_cents: newAmount.toString(),
            source: 'stripe_payment_link',
            installment_label: installment.installment_label,
            installment_number: installment.installment_number.toString(),
            recalculated_at: new Date().toISOString()
          },
          after_completion: {
            type: 'redirect',
            redirect: {
              url: `${process.env.NEXT_PUBLIC_BASE_URL}/invoice/${invoice.access_token}?payment=success`
            }
          }
        });

        newPaymentLinkId = paymentLink.id;
        newPaymentLinkUrl = paymentLink.url;
      } catch (stripeErr) {
        console.error(`Failed to create new payment link:`, stripeErr);
      }

      // Update installment in database
      const { error: updateErr } = await supabase
        .from("invoice_payment_plans")
        .update({
          amount_cents: newAmount,
          stripe_payment_link_id: newPaymentLinkId,
          stripe_payment_link_url: newPaymentLinkUrl,
          updated_at: new Date().toISOString()
        })
        .eq("id", installment.id);

      if (!updateErr) {
        updatedInstallments.push({
          id: installment.id,
          installment_label: installment.installment_label,
          old_amount_cents: installment.amount_cents,
          new_amount_cents: newAmount,
          payment_link_url: newPaymentLinkUrl
        });
      }
    }

    return NextResponse.json({
      message: "Payment plan recalculated",
      invoice_total_cents: invoice.amount_cents,
      plan_type: invoice.payment_plan_type,
      installments: updatedInstallments
    });
  } catch (error) {
    console.error("Error recalculating payment plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}