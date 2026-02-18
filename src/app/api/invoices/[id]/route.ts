import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

type Ctx = { params: Promise<{ id: string }> };

interface LineItem {
  title?: string;
  description?: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
}

function calculateInvoiceTotals(line_items: LineItem[], discount_type?: string, discount_value?: number) {
  const subtotal_cents = line_items.reduce((sum, item) => sum + item.amount_cents, 0);

  let discount_cents = 0;
  if (discount_value && discount_value > 0) {
    if (discount_type === 'percentage') {
      discount_cents = Math.round(subtotal_cents * (discount_value / 100));
    } else if (discount_type === 'fixed') {
      discount_cents = Math.round(discount_value * 100);
    }
  }

  const tax_cents = 0;
  const total_cents = subtotal_cents + tax_cents - discount_cents;

  return { subtotal_cents, tax_cents, discount_cents, total_cents };
}

// Calculate installment amounts based on plan type
function calculateInstallmentAmounts(totalCents: number, planType: string, installmentCount: number): number[] {
  switch (planType) {
    case '50_50':
      const half = Math.round(totalCents / 2);
      return [half, totalCents - half]; // Ensure they sum to exact total
    case '40_30_30':
      const first = Math.round(totalCents * 0.4);
      const second = Math.round(totalCents * 0.3);
      const third = totalCents - first - second; // Remainder to ensure exact sum
      return [first, second, third];
    case 'custom':
      // For custom plans, distribute evenly
      const perInstallment = Math.round(totalCents / installmentCount);
      const amounts = Array(installmentCount).fill(perInstallment);
      // Adjust last installment for rounding
      amounts[amounts.length - 1] = totalCents - (perInstallment * (installmentCount - 1));
      return amounts;
    default:
      return [totalCents];
  }
}

// Recalculate payment plan installments when invoice total changes
async function recalculatePaymentPlanInstallments(
  supabase: any,
  invoiceId: string,
  newTotalCents: number,
  planType: string,
  orgId: string
) {
  try {
    // Get existing installments
    const { data: installments, error: fetchError } = await supabase
      .from("invoice_payment_plans")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("installment_number");

    if (fetchError || !installments || installments.length === 0) {
      console.log("No payment plan installments to update");
      return;
    }

    // Calculate new amounts
    const newAmounts = calculateInstallmentAmounts(newTotalCents, planType, installments.length);

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Get invoice details for creating new payment links
    const { data: invoice } = await supabase
      .from("invoices")
      .select(`
        invoice_number, access_token, client_id,
        clients!inner(name, email)
      `)
      .eq("id", invoiceId)
      .single();

    // Update each installment
    for (let i = 0; i < installments.length; i++) {
      const installment = installments[i];
      const newAmount = newAmounts[i];

      // Only update if amount actually changed
      if (installment.amount_cents === newAmount) {
        continue;
      }

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

      // Create new Stripe payment link with updated amount
      let newPaymentLinkId = null;
      let newPaymentLinkUrl = null;

      if (invoice) {
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
              updated_at: new Date().toISOString()
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
          console.error(`Failed to create new payment link for installment ${installment.id}:`, stripeErr);
        }
      }

      // Update installment in database
      await supabase
        .from("invoice_payment_plans")
        .update({
          amount_cents: newAmount,
          stripe_payment_link_id: newPaymentLinkId,
          stripe_payment_link_url: newPaymentLinkUrl,
          updated_at: new Date().toISOString()
        })
        .eq("id", installment.id);
    }

    console.log(`Payment plan installments recalculated for invoice ${invoiceId}`);
  } catch (error) {
    console.error("Error recalculating payment plan installments:", error);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { id: invoiceId } = await ctx.params;
  const body = await req.json();

  const supabase = await supabaseServer();

  try {
    // Verify invoice belongs to org and get current data
    const { data: invoice, error: lookupError } = await supabase
      .from("invoices")
      .select("id, org_id, client_id, status, line_items, discount_type, discount_value, amount_cents, payment_plan_enabled, payment_plan_type")
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .single();

    if (lookupError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Build update payload - allow editing ALL fields
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Core fields
    if (body.client_id !== undefined) updatePayload.client_id = body.client_id;
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.notes !== undefined) updatePayload.notes = body.notes;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.payment_terms !== undefined) updatePayload.payment_terms = body.payment_terms;

    // Line items - recalculate totals if provided
    if (body.line_items !== undefined) {
      updatePayload.line_items = body.line_items;
      const { subtotal_cents, tax_cents, discount_cents, total_cents } = calculateInvoiceTotals(
        body.line_items,
        body.discount_type ?? invoice.discount_type,
        body.discount_value ?? invoice.discount_value
      );
      updatePayload.subtotal_cents = subtotal_cents;
      updatePayload.tax_cents = tax_cents;
      updatePayload.discount_cents = discount_cents;
      updatePayload.amount_cents = total_cents;
    } else if (body.amount_cents !== undefined) {
      // Direct amount update (legacy support)
      updatePayload.amount_cents = body.amount_cents;
    }

    // Discount fields - recalculate if changed
    if (body.discount_type !== undefined) updatePayload.discount_type = body.discount_type;
    if (body.discount_value !== undefined) {
      updatePayload.discount_value = body.discount_value;
      // Recalculate totals if we have line items
      if (body.line_items || invoice.line_items) {
        const items = body.line_items || invoice.line_items;
        const { subtotal_cents, tax_cents, discount_cents, total_cents } = calculateInvoiceTotals(
          items,
          body.discount_type ?? invoice.discount_type,
          body.discount_value
        );
        updatePayload.subtotal_cents = subtotal_cents;
        updatePayload.tax_cents = tax_cents;
        updatePayload.discount_cents = discount_cents;
        updatePayload.amount_cents = total_cents;
      }
    }

    // Dates
    if (body.issued_at !== undefined) updatePayload.issued_at = body.issued_at;
    if (body.due_at !== undefined) updatePayload.due_at = body.due_at;

    // Project fields
    if (body.project_overview !== undefined) updatePayload.project_overview = body.project_overview;
    if (body.project_start_date !== undefined) updatePayload.project_start_date = body.project_start_date;
    if (body.delivery_date !== undefined) updatePayload.delivery_date = body.delivery_date;
    if (body.technology_stack !== undefined) updatePayload.technology_stack = body.technology_stack;
    if (body.terms_conditions !== undefined) updatePayload.terms_conditions = body.terms_conditions;

    // Signature
    if (body.require_signature !== undefined) updatePayload.require_signature = body.require_signature;

    // Branding
    if (body.brand_logo_url !== undefined) updatePayload.brand_logo_url = body.brand_logo_url;
    if (body.brand_primary !== undefined) updatePayload.brand_primary = body.brand_primary;

    // Payment plan fields
    if (body.payment_plan_enabled !== undefined) updatePayload.payment_plan_enabled = body.payment_plan_enabled;
    if (body.payment_plan_type !== undefined) updatePayload.payment_plan_type = body.payment_plan_type;

    // Handle status changes
    if (body.status === 'paid' && invoice.status !== 'paid') {
      updatePayload.paid_at = new Date().toISOString();
    } else if (body.status && body.status !== 'paid' && invoice.status === 'paid') {
      updatePayload.paid_at = null;
    }

    // Update the invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
    }

    // Handle payment plan installments update
    if (body.payment_plan_installments !== undefined) {
      // Delete existing installments for this invoice
      await supabase
        .from("invoice_payment_plans")
        .delete()
        .eq("invoice_id", invoiceId);

      // Insert new installments if payment plan is enabled
      const planEnabled = body.payment_plan_enabled ?? invoice.payment_plan_enabled;
      const planType = body.payment_plan_type ?? invoice.payment_plan_type;
      if (planEnabled && planType !== 'full' && body.payment_plan_installments.length > 0) {
        const installmentRows = body.payment_plan_installments.map((inst: any) => ({
          invoice_id: invoiceId,
          plan_type: planType,
          installment_number: inst.installment_number,
          installment_label: inst.installment_label,
          amount_cents: inst.amount_cents,
          due_date: inst.due_date,
          grace_period_days: inst.grace_period_days ?? 3,
          status: 'pending',
        }));

        const { error: insertError } = await supabase
          .from("invoice_payment_plans")
          .insert(installmentRows);

        if (insertError) {
          console.error("Error inserting payment plan installments:", insertError);
        }
      }
    } else {
      // No explicit installments provided - recalculate if total changed and payment plan exists
      const newTotal = updatePayload.amount_cents as number | undefined;
      if (newTotal && newTotal !== invoice.amount_cents && invoice.payment_plan_enabled) {
        await recalculatePaymentPlanInstallments(
          supabase,
          invoiceId,
          newTotal,
          invoice.payment_plan_type,
          orgId
        );
      }
    }

    return NextResponse.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error("Error in invoice update:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { hard = true } = await req.json().catch(() => ({ hard: true }));

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, client_id, stripe_invoice_id")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (invErr || !inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Touch Stripe if mirrored there
  if (inv.stripe_invoice_id) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    try {
      const s = await stripe.invoices.retrieve(inv.stripe_invoice_id);
      if (s.status === "paid") {
        return NextResponse.json({ error: "Paid invoices cannot be deleted." }, { status: 409 });
      }
      if (s.status === "draft") {
        if (typeof s.id === "string") {
          await stripe.invoices.del(s.id);
        } else {
          throw new Error("Stripe invoice id is undefined.");
        }
      } else if (s.status !== "void") {
        if (typeof s.id === "string") {
          await stripe.invoices.voidInvoice(s.id);
        } else {
          throw new Error("Stripe invoice id is undefined.");
        }
      }
    } catch {
      // If it doesn't exist in Stripe anymore, continue and delete locally.
    }
  }

  if (hard) {
    // Clear last_invoice_id references in recurring_invoices before deleting
    await supabase
      .from("recurring_invoices")
      .update({ last_invoice_id: null })
      .eq("last_invoice_id", id)
      .eq("org_id", orgId);

    const { error } = await supabase.from("invoices").delete().eq("id", id).eq("org_id", orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, deleted: true });
  } else {
    const { data: updated, error } = await supabase
      .from("invoices")
      .update({ status: "void" })
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id,stripe_invoice_id,status,amount_cents,issued_at,due_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, deleted: false, invoice: updated });
  }
}
