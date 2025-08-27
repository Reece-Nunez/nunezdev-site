import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import { sendInvoiceEmail } from "@/lib/email";
import { currency } from "@/lib/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPaymentTermsDays(terms: string): number {
  switch (terms) {
    case 'due_on_receipt': return 0;
    case '7': return 7;
    case '14': return 14;
    case '30': return 30;
    case '45': return 45;
    case '60': return 60;
    case '90': return 90;
    default: return 30;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  
  const { id: invoiceId } = await context.params;
  const supabase = await supabaseServer();

  try {
    // Fetch invoice with enhanced details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id, client_id, status, amount_cents, line_items, payment_terms,
        title, description, require_signature, access_token, invoice_number,
        clients!inner(id, name, email, stripe_customer_id)
      `)
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== 'draft') {
      return NextResponse.json({ error: "Only draft invoices can be sent" }, { status: 400 });
    }

    if (!(invoice.clients as any).email) {
      return NextResponse.json({ error: "Client must have an email address to send invoice" }, { status: 400 });
    }

    const client = invoice.clients;
    let stripeInvoiceUrl = null;
    let agreementUrl = null;

    // Create Stripe Payment Link if Stripe is configured
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        // Create a payment link with the invoice amount
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: invoice.title || `Invoice ${invoice.invoice_number || invoice.id.split('-')[0]}`,
                  description: invoice.description || 'Professional web development services',
                  metadata: {
                    invoice_id: invoice.id,
                    client_id: (client as any).id,
                    org_id: orgId,
                  },
                },
                unit_amount: invoice.amount_cents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            invoice_id: invoice.id,
            client_id: (client as any).id,
            org_id: orgId,
            invoice_number: invoice.invoice_number || '',
          },
          after_completion: {
            type: 'redirect',
            redirect: {
              url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com'}/invoice/${invoice.access_token}?payment=success`,
            },
          },
        });

        stripeInvoiceUrl = paymentLink.url;

        // Update database with Payment Link URL
        await supabase
          .from("invoices")
          .update({ 
            stripe_payment_link: paymentLink.id,
            stripe_hosted_invoice_url: paymentLink.url 
          })
          .eq("id", invoiceId);

      } catch (stripeError) {
        console.error("Stripe Payment Link error:", stripeError);
        // Continue without Stripe - still send local invoice
      }
    }

    // Calculate due date
    const daysUntilDue = getPaymentTermsDays(invoice.payment_terms || '30');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysUntilDue);

    // Generate agreement URL if signature required
    if (invoice.require_signature) {
      agreementUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com'}/invoices/${invoiceId}/agreement`;
    }

    // Update invoice status
    const updatePayload = {
      status: 'sent',
      issued_at: new Date().toISOString(),
      due_at: dueDate.toISOString(),
      hosted_invoice_url: agreementUrl || stripeInvoiceUrl || null,
    };

    const { error: updateError } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .eq("org_id", orgId);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json({ error: "Failed to update invoice status" }, { status: 500 });
    }

    // Send email with secure invoice link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
    const secureInvoiceUrl = `${baseUrl}/invoice/${invoice.access_token}`;
    
    try {
      await sendInvoiceEmail({
        to: (client as any).email,
        clientName: (client as any).name,
        invoiceNumber: invoice.invoice_number || `INV-${invoice.id.split('-')[0]}`,
        invoiceUrl: secureInvoiceUrl,
        amount: currency(invoice.amount_cents),
        dueDate: dueDate.toLocaleDateString(),
        requiresSignature: invoice.require_signature || false,
      });
      
      console.log(`Invoice email sent to ${(client as any).email}`);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail the request - invoice is still sent
    }

    return NextResponse.json({
      success: true,
      message: process.env.RESEND_API_KEY 
        ? "Invoice sent successfully! Email has been sent to the (client as any)." 
        : `Invoice sent successfully! Share this link with your client: ${secureInvoiceUrl}`,
      stripe_invoice_url: stripeInvoiceUrl,
      agreement_url: agreementUrl,
      hosted_url: secureInvoiceUrl,
      secure_invoice_url: secureInvoiceUrl,
      client_email: (client as any).email,
    });

  } catch (error) {
    console.error("Error sending invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}