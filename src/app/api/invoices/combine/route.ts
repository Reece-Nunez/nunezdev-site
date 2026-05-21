import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import { sendInvoiceEmail } from "@/lib/email";
import { sendInvoiceSmsWithGuards } from "@/lib/invoiceSms";
import { isTwilioConfigured, normalizePhoneE164 } from "@/lib/sms";
import { currency } from "@/lib/ui";
import Stripe from "stripe";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type DeliveryMethod = 'email' | 'sms' | 'both';

interface CombineRequest {
  invoice_ids: string[];
  send_immediately?: boolean;
  /** How to deliver the combined invoice. Defaults to 'email' for back-compat. */
  delivery_method?: DeliveryMethod;
  /** Optional override for SMS recipient — falls back to client.phone on file. */
  sms_to?: string;
}

interface InvoiceLineItem {
  title?: string;
  description: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
}

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

// Get the most lenient payment terms (highest number of days)
function getMostLenientTerms(invoices: { payment_terms?: string }[]): string {
  const terms = invoices.map(inv => inv.payment_terms || '30');
  const days = terms.map(t => getPaymentTermsDays(t));
  const maxDays = Math.max(...days);

  // Convert back to terms string
  if (maxDays === 0) return 'due_on_receipt';
  if (maxDays === 7) return '7';
  if (maxDays === 14) return '14';
  if (maxDays === 30) return '30';
  if (maxDays === 45) return '45';
  if (maxDays === 60) return '60';
  if (maxDays === 90) return '90';
  return '30';
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = guard.orgId!;

  try {
    const body: CombineRequest = await req.json();
    const {
      invoice_ids,
      send_immediately = true,
      delivery_method = 'email',
      sms_to,
    } = body;

    if (!['email', 'sms', 'both'].includes(delivery_method)) {
      return NextResponse.json(
        { error: "delivery_method must be 'email', 'sms', or 'both'" },
        { status: 400 }
      );
    }

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length < 2) {
      return NextResponse.json(
        { error: "Please select at least 2 invoices to combine" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    // Fetch all selected invoices with client and payment info
    const { data: invoices, error: fetchError } = await supabase
      .from("invoices")
      .select(`
        id, client_id, status, amount_cents, subtotal_cents, discount_cents,
        line_items, payment_terms, title, description, invoice_number, notes,
        require_signature, issued_at, due_at,
        clients!inner(id, name, email, phone, stripe_customer_id),
        invoice_payments(amount_cents)
      `)
      .eq("org_id", orgId)
      .in("id", invoice_ids);

    if (fetchError || !invoices) {
      console.error("Error fetching invoices:", fetchError);
      return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
    }

    if (invoices.length !== invoice_ids.length) {
      return NextResponse.json(
        { error: "Some invoices were not found" },
        { status: 404 }
      );
    }

    // Validate all invoices belong to the same client
    const clientIds = new Set(invoices.map(inv => inv.client_id));
    if (clientIds.size > 1) {
      return NextResponse.json(
        { error: "All invoices must belong to the same client" },
        { status: 400 }
      );
    }

    // Validate invoice statuses (can't combine paid or voided invoices)
    const invalidInvoices = invoices.filter(inv =>
      inv.status === 'paid' || inv.status === 'void'
    );
    if (invalidInvoices.length > 0) {
      return NextResponse.json(
        { error: "Cannot combine paid or voided invoices" },
        { status: 400 }
      );
    }

    // Handle client - could be array or single object from Supabase join
    const clientData = invoices[0].clients;
    const client = (Array.isArray(clientData) ? clientData[0] : clientData) as { id: string; name: string; email: string; phone?: string | null; stripe_customer_id?: string };

    // Calculate remaining balance for each invoice (handle partial payments)
    const invoicesWithBalance = invoices.map(inv => {
      const totalPaid = ((inv.invoice_payments as { amount_cents: number }[]) || [])
        .reduce((sum, p) => sum + p.amount_cents, 0);
      const remainingBalance = inv.amount_cents - totalPaid;
      return { ...inv, remaining_balance: remainingBalance, total_paid: totalPaid };
    });

    // Check if any invoice has partial payments
    const hasPartialPayments = invoicesWithBalance.some(inv => inv.total_paid > 0);

    // Combine line items from all invoices
    const combinedLineItems: InvoiceLineItem[] = [];
    const invoiceNumbers: string[] = [];

    for (const invoice of invoicesWithBalance) {
      const invNumber = invoice.invoice_number || `INV-${invoice.id.split('-')[0]}`;
      invoiceNumbers.push(invNumber);

      const lineItems = (invoice.line_items as InvoiceLineItem[]) || [];

      if (lineItems.length === 0) {
        // If no line items, create one from the invoice total
        combinedLineItems.push({
          title: `${invNumber} - ${invoice.title || 'Invoice'}`,
          description: invoice.description || 'Services rendered',
          quantity: 1,
          rate_cents: invoice.remaining_balance,
          amount_cents: invoice.remaining_balance,
        });
      } else {
        // Add each line item with reference to original invoice
        for (const item of lineItems) {
          // If there were partial payments, we need to adjust proportionally
          let adjustedAmount = item.amount_cents;
          let adjustedRate = item.rate_cents;

          if (hasPartialPayments && invoice.total_paid > 0) {
            const ratio = invoice.remaining_balance / invoice.amount_cents;
            adjustedAmount = Math.round(item.amount_cents * ratio);
            adjustedRate = Math.round(item.rate_cents * ratio);
          }

          combinedLineItems.push({
            title: `${item.title || 'Service'} (${invNumber})`,
            description: item.description,
            quantity: item.quantity,
            rate_cents: adjustedRate,
            amount_cents: adjustedAmount,
          });
        }
      }
    }

    // Calculate combined totals
    const combinedTotal = combinedLineItems.reduce((sum, item) => sum + item.amount_cents, 0);

    // Generate invoice number
    const timestamp = Date.now();
    const newInvoiceNumber = `INV-${timestamp}`;

    // Generate access token
    const accessToken = crypto.randomBytes(32).toString('hex');

    // Get most lenient payment terms
    const paymentTerms = getMostLenientTerms(invoices);
    const daysUntilDue = getPaymentTermsDays(paymentTerms);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysUntilDue);

    // Create combined invoice
    const { data: newInvoice, error: createError } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        client_id: client.id,
        status: send_immediately ? 'sent' : 'draft',
        invoice_number: newInvoiceNumber,
        title: `Combined Invoice - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        description: `Combined from invoices: ${invoiceNumbers.join(', ')}`,
        notes: `This invoice combines the following outstanding invoices:\n${invoiceNumbers.map(n => `• ${n}`).join('\n')}${hasPartialPayments ? '\n\nNote: Some invoices had partial payments which have been credited.' : ''}`,
        line_items: combinedLineItems,
        amount_cents: combinedTotal,
        subtotal_cents: combinedTotal,
        tax_cents: 0,
        discount_cents: 0,
        payment_terms: paymentTerms,
        require_signature: invoices.some(inv => inv.require_signature),
        access_token: accessToken,
        issued_at: send_immediately ? new Date().toISOString() : null,
        due_at: send_immediately ? dueDate.toISOString() : null,
      })
      .select()
      .single();

    if (createError || !newInvoice) {
      console.error("Error creating combined invoice:", createError);
      return NextResponse.json({ error: "Failed to create combined invoice" }, { status: 500 });
    }

    // ----- PRE-FLIGHT DELIVERY VALIDATION ----------------------------------
    // Validate everything we need BEFORE voiding originals — voiding is the
    // first irreversible mutation, and we'd rather bail with a 400 than
    // leave the operator with orphaned voided invoices and no way to deliver.
    const needsEmailPreflight = (delivery_method === 'email' || delivery_method === 'both');
    const needsSmsPreflight = (delivery_method === 'sms' || delivery_method === 'both');

    if (send_immediately && needsEmailPreflight && !client.email) {
      return NextResponse.json(
        { error: `This client has no email on file. Pick "Text" instead, or add an email to the client record first.` },
        { status: 400 }
      );
    }

    if (send_immediately && needsSmsPreflight) {
      if (!isTwilioConfigured()) {
        return NextResponse.json(
          { error: `SMS isn't configured (Twilio env vars missing). Pick "Email" instead, or add Twilio config in Vercel.` },
          { status: 400 }
        );
      }
      const rawSmsPhone = (sms_to ?? client.phone ?? '').trim();
      if (!rawSmsPhone) {
        return NextResponse.json(
          { error: `No phone number provided for SMS and none on file for this client.` },
          { status: 400 }
        );
      }
      if (!normalizePhoneE164(rawSmsPhone)) {
        return NextResponse.json(
          { error: `Couldn't parse phone "${rawSmsPhone}". Use a US format like (405) 555-1234.` },
          { status: 400 }
        );
      }
    }

    // ----- IDEMPOTENCY CHECK -----------------------------------------------
    // Double-click on the modal can send two POSTs before the second sees
    // the first's response. Detect by checking whether any source invoice
    // is already void with a "Combined into" note — that's the signature
    // of a previous successful combine for this same source set.
    const alreadyCombined = invoices.find(
      (inv) =>
        inv.status === 'void' &&
        typeof inv.notes === 'string' &&
        inv.notes.startsWith('Voided - Combined into ')
    );
    if (alreadyCombined) {
      const match = alreadyCombined.notes?.match(/Combined into (\S+)/);
      const targetNumber = match?.[1];
      return NextResponse.json(
        {
          error: `These invoices were already combined${
            targetNumber ? ` into ${targetNumber}` : ''
          }. Refresh the page to see the result.`,
        },
        { status: 409 }
      );
    }

    // Void original invoices and update their notes
    for (const inv of invoices) {
      const { error: voidError } = await supabase
        .from("invoices")
        .update({
          status: 'void',
          notes: `Voided - Combined into ${newInvoiceNumber}`
        })
        .eq("id", inv.id)
        .eq("org_id", orgId);

      if (voidError) {
        console.error("Error voiding invoice:", inv.id, voidError);
      }
    }

    let stripeUrl: string | null = null;

    // Create the Stripe Payment Link + deliver via the chosen channel(s).
    // All pre-flight validation already ran above the void loop, so by the
    // time we're here we know the chosen channels are wired up correctly.
    const needsEmail = needsEmailPreflight;
    const needsSms = needsSmsPreflight;

    if (send_immediately) {
      // Create Stripe Payment Link
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

          const paymentLink = await stripe.paymentLinks.create({
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: newInvoice.title || `Combined Invoice ${newInvoiceNumber}`,
                    description: `Combined invoice for ${client.name}`,
                    metadata: {
                      invoice_id: newInvoice.id,
                      client_id: client.id,
                      org_id: orgId,
                    },
                  },
                  unit_amount: combinedTotal,
                },
                quantity: 1,
              },
            ],
            metadata: {
              invoice_id: newInvoice.id,
              client_id: client.id,
              org_id: orgId,
              invoice_number: newInvoiceNumber,
              client_email: client.email,
              client_name: client.name,
              amount_cents: combinedTotal.toString(),
              source: 'stripe_payment_link',
              combined_from: invoiceNumbers.join(','),
              created_at: new Date().toISOString()
            },
            payment_intent_data: {
              metadata: {
                invoice_id: newInvoice.id,
                client_id: client.id,
                org_id: orgId,
                invoice_number: newInvoiceNumber,
                client_email: client.email,
                client_name: client.name,
                amount_cents: combinedTotal.toString(),
                source: 'stripe_payment_link',
                created_at: new Date().toISOString()
              }
            },
            after_completion: {
              type: 'redirect',
              redirect: {
                url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com'}/invoice/${accessToken}?payment=success`,
              },
            },
          });

          stripeUrl = paymentLink.url;

          // Update invoice with payment link
          await supabase
            .from("invoices")
            .update({
              stripe_payment_link: paymentLink.id,
              stripe_hosted_invoice_url: paymentLink.url
            })
            .eq("id", newInvoice.id);

        } catch (stripeError) {
          console.error("Stripe Payment Link error:", stripeError);
          // Continue without Stripe
        }
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
      const secureInvoiceUrl = `${baseUrl}/invoice/${accessToken}`;

      const deliveryResults: { email?: 'sent' | 'failed'; sms?: 'sent' | 'failed'; smsError?: string; emailError?: string } = {};

      if (needsEmail) {
        try {
          await sendInvoiceEmail({
            to: client.email,
            clientName: client.name,
            invoiceNumber: newInvoiceNumber,
            invoiceUrl: secureInvoiceUrl,
            amount: currency(combinedTotal),
            dueDate: dueDate.toLocaleDateString(),
            requiresSignature: newInvoice.require_signature || false,
          });
          deliveryResults.email = 'sent';
          console.log(`Combined invoice email sent to ${client.email}`);
        } catch (emailError) {
          deliveryResults.email = 'failed';
          deliveryResults.emailError = emailError instanceof Error ? emailError.message : String(emailError);
          console.error("Combined invoice email failed:", emailError);
        }
      }

      if (needsSms) {
        const smsResult = await sendInvoiceSmsWithGuards({
          invoiceId: newInvoice.id,
          orgId,
          to: sms_to ?? null,
          clientPhoneOnFile: client.phone ?? null,
          bodyOverride: null,
          clientName: client.name,
          clientId: client.id,
          invoiceNumber: newInvoiceNumber,
          amountCents: combinedTotal,
          accessToken,
        });
        if (smsResult.ok) {
          deliveryResults.sms = 'sent';
          console.log(`Combined invoice SMS sent to ${smsResult.to}`);
        } else {
          deliveryResults.sms = 'failed';
          deliveryResults.smsError = smsResult.error;
          console.error("Combined invoice SMS failed:", smsResult.error);
        }
      }

      // Attach delivery results to the response for the modal to show
      (newInvoice as Record<string, unknown>).delivery_results = deliveryResults;
    }

    const deliveryResults = (newInvoice as Record<string, unknown>).delivery_results as
      | { email?: 'sent' | 'failed'; sms?: 'sent' | 'failed'; smsError?: string; emailError?: string }
      | undefined;

    // Build a friendly message that reflects what actually happened
    let message: string;
    if (!send_immediately) {
      message = `Combined ${invoices.length} invoices into draft ${newInvoiceNumber}`;
    } else {
      const sent: string[] = [];
      const failed: string[] = [];
      if (deliveryResults?.email === 'sent') sent.push(`emailed to ${client.email}`);
      if (deliveryResults?.email === 'failed') failed.push('email');
      if (deliveryResults?.sms === 'sent') sent.push('texted');
      if (deliveryResults?.sms === 'failed') failed.push(`text (${deliveryResults.smsError || 'unknown error'})`);
      if (sent.length && !failed.length) {
        message = `Combined ${invoices.length} invoices — ${sent.join(' and ')}.`;
      } else if (sent.length && failed.length) {
        message = `Combined ${invoices.length} invoices. Successfully ${sent.join(' and ')}, but failed to send via ${failed.join(' and ')}.`;
      } else if (failed.length) {
        message = `Combined ${invoices.length} invoices but delivery failed: ${failed.join(', ')}. You can resend manually from the invoice detail page.`;
      } else {
        message = `Combined ${invoices.length} invoices into ${newInvoiceNumber}.`;
      }
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: newInvoice.id,
        invoice_number: newInvoiceNumber,
        amount_cents: combinedTotal,
        status: newInvoice.status,
      },
      voided_count: invoices.length,
      voided_invoice_numbers: invoiceNumbers,
      stripe_url: stripeUrl,
      delivery_results: deliveryResults,
      message,
    });

  } catch (error) {
    console.error("Error combining invoices:", error);
    return NextResponse.json({ error: "Failed to combine invoices" }, { status: 500 });
  }
}
