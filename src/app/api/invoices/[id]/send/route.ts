import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import { sendInvoiceEmail } from "@/lib/email";
import { currency } from "@/lib/ui";
import { calendarService } from "@/lib/google";

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

  // Parse request body for CC emails
  let ccEmails: string[] = [];
  try {
    const body = await req.json();
    if (body.ccEmails && Array.isArray(body.ccEmails)) {
      ccEmails = body.ccEmails.filter((email: string) =>
        typeof email === 'string' && email.includes('@')
      );
    }
  } catch {
    // No body or invalid JSON is fine - ccEmails stays empty
  }

  try {
    // Fetch invoice with enhanced details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id, client_id, status, amount_cents, line_items, payment_terms,
        title, description, require_signature, access_token, invoice_number,
        payment_plan_enabled, payment_plan_type,
        clients!inner(id, name, email, stripe_customer_id)
      `)
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Allow sending/resending for any status except 'paid'
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: "Cannot resend a fully paid invoice" }, { status: 400 });
    }

    const isResend = invoice.status !== 'draft';

    if (!(invoice.clients as any).email) {
      return NextResponse.json({ error: "Client must have an email address to send invoice" }, { status: 400 });
    }

    const client = invoice.clients;
    let stripeInvoiceUrl = null;
    let agreementUrl = null;

    // Create Stripe Payment Links
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        // Check if invoice has payment plan enabled
        if (invoice.payment_plan_enabled && invoice.payment_plan_type !== 'full') {
          // Get payment plan installments
          const { data: installments, error: installmentsError } = await supabase
            .from("invoice_payment_plans")
            .select("*")
            .eq("invoice_id", invoiceId)
            .order("installment_number");

          if (!installmentsError && installments && installments.length > 0) {
            console.log(`Creating ${installments.length} payment links for payment plan invoice ${invoiceId}`);
            
            // Create payment links for each installment
            for (const installment of installments) {
              const installmentPaymentLink = await stripe.paymentLinks.create({
                line_items: [
                  {
                    price_data: {
                      currency: 'usd',
                      product_data: {
                        name: `${invoice.invoice_number || invoice.id.split('-')[0]} - ${installment.installment_label}`,
                        description: `${installment.installment_label} for ${(client as any).name}`,
                        metadata: {
                          invoice_id: invoice.id,
                          installment_id: installment.id,
                          client_id: (client as any).id,
                          org_id: orgId,
                        },
                      },
                      unit_amount: installment.amount_cents,
                    },
                    quantity: 1,
                  },
                ],
                metadata: {
                  invoice_id: invoice.id,
                  installment_id: installment.id,
                  client_id: (client as any).id,
                  org_id: orgId,
                  invoice_number: invoice.invoice_number || '',
                  client_email: (client as any).email,
                  client_name: (client as any).name,
                  amount_cents: installment.amount_cents.toString(),
                  source: 'stripe_payment_link',
                  installment_label: installment.installment_label,
                  installment_number: installment.installment_number.toString(),
                  created_at: new Date().toISOString()
                },
                payment_intent_data: {
                  metadata: {
                    invoice_id: invoice.id,
                    installment_id: installment.id,
                    client_id: (client as any).id,
                    org_id: orgId,
                    invoice_number: invoice.invoice_number || '',
                    client_email: (client as any).email,
                    client_name: (client as any).name,
                    amount_cents: installment.amount_cents.toString(),
                    source: 'stripe_payment_link',
                    installment_label: installment.installment_label,
                    installment_number: installment.installment_number.toString(),
                    created_at: new Date().toISOString()
                  }
                },
                after_completion: {
                  type: 'redirect',
                  redirect: {
                    url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com'}/invoice/${invoice.access_token}?payment=success&installment=${installment.installment_number}`,
                  },
                },
              });

              // Update installment with payment link
              await supabase
                .from("invoice_payment_plans")
                .update({
                  stripe_payment_link_id: installmentPaymentLink.id,
                  stripe_payment_link_url: installmentPaymentLink.url,
                })
                .eq("id", installment.id);
            }

            // For payment plans, we don't set a single stripeInvoiceUrl since there are multiple links
            stripeInvoiceUrl = null;
            console.log(`Successfully created payment links for all ${installments.length} installments`);
          }
        } else {
          // Create single payment link for non-payment-plan invoices
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
              client_email: (client as any).email,
              client_name: (client as any).name,
              amount_cents: invoice.amount_cents.toString(),
              source: 'stripe_payment_link',
              created_at: new Date().toISOString()
            },
            payment_intent_data: {
              metadata: {
                invoice_id: invoice.id,
                client_id: (client as any).id,
                org_id: orgId,
                invoice_number: invoice.invoice_number || '',
                client_email: (client as any).email,
                client_name: (client as any).name,
                amount_cents: invoice.amount_cents.toString(),
                source: 'stripe_payment_link',
                created_at: new Date().toISOString()
              }
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
        }

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

    // Update invoice - only change status/dates if first send (not resend)
    const updatePayload: Record<string, unknown> = {
      hosted_invoice_url: agreementUrl || stripeInvoiceUrl || null,
    };

    if (!isResend) {
      // First time sending - set status and dates
      updatePayload.status = 'sent';
      updatePayload.issued_at = new Date().toISOString();
      updatePayload.due_at = dueDate.toISOString();
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .eq("org_id", orgId);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json({ error: "Failed to update invoice status" }, { status: 500 });
    }

    // Create calendar event for invoice due date (async, don't block)
    if (!isResend && calendarService.isAvailable()) {
      calendarService
        .createEvent({
          summary: `Invoice Due: ${(client as any).name} - ${currency(invoice.amount_cents)}`,
          description: `Invoice ${invoice.invoice_number || invoiceId} is due today.\n\nClient: ${(client as any).name}\nEmail: ${(client as any).email}\nAmount: ${currency(invoice.amount_cents)}`,
          start: {
            date: dueDate.toISOString().split('T')[0],
          },
          end: {
            date: dueDate.toISOString().split('T')[0],
          },
        })
        .then((result) => {
          if (result.success) {
            console.log(`Calendar event created for invoice ${invoice.invoice_number} due date`);
          }
        })
        .catch((err) => {
          console.error('Failed to create calendar event for invoice:', err.message);
        });
    }

    // Send email with secure invoice link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
    const secureInvoiceUrl = `${baseUrl}/invoice/${invoice.access_token}`;

    try {
      await sendInvoiceEmail({
        to: (client as any).email,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        clientName: (client as any).name,
        invoiceNumber: invoice.invoice_number || `INV-${invoice.id.split('-')[0]}`,
        invoiceUrl: secureInvoiceUrl,
        amount: currency(invoice.amount_cents),
        dueDate: dueDate.toLocaleDateString(),
        requiresSignature: invoice.require_signature || false,
      });

      const ccInfo = ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : '';
      console.log(`Invoice email sent to ${(client as any).email}${ccInfo}`);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail the request - invoice is still sent
    }

    const action = isResend ? "resent" : "sent";
    return NextResponse.json({
      success: true,
      message: process.env.RESEND_API_KEY
        ? `Invoice ${action} successfully! Email has been sent to the client.`
        : `Invoice ${action} successfully! Share this link with your client: ${secureInvoiceUrl}`,
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