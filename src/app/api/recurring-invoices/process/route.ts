import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { sendInvoiceEmail } from "@/lib/email";
import { currency } from "@/lib/ui";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Structured logging for observability
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'recurring-invoices',
    level,
    message,
    ...data,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// Write to recurring_invoice_logs table for dashboard visibility
async function writeLog(
  db: ReturnType<typeof supabaseAdmin>,
  orgId: string,
  eventType: string,
  status: string,
  message: string,
  opts?: { recurringInvoiceId?: string; invoiceId?: string; metadata?: Record<string, unknown> }
) {
  await db.from('recurring_invoice_logs').insert({
    org_id: orgId,
    recurring_invoice_id: opts?.recurringInvoiceId || null,
    invoice_id: opts?.invoiceId || null,
    event_type: eventType,
    status,
    message,
    metadata: opts?.metadata || null,
  }).then(({ error }) => {
    if (error) log('warn', 'Failed to write activity log', { error: error.message });
  });
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-07-30.basil',
    });

    // --- Auth ---
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let isAuthorized = isCronRequest;
    if (!isCronRequest) {
      try {
        const supabase = await supabaseServer();
        const { data: { user } } = await supabase.auth.getUser();
        isAuthorized = !!user;
      } catch {
        isAuthorized = false;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = supabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    // --- Fetch due recurring invoices ---
    const { data: recurringInvoices, error } = await adminSupabase
      .from('recurring_invoices')
      .select(`
        *,
        clients!client_id (
          id,
          name,
          email,
          company,
          phone,
          stripe_customer_id
        )
      `)
      .eq('status', 'active')
      .lte('next_invoice_date', today);

    if (error) {
      log('error', 'Failed to fetch recurring invoices', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!recurringInvoices || recurringInvoices.length === 0) {
      log('info', 'No recurring invoices due for processing');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No recurring invoices due',
        results: [],
      });
    }

    log('info', 'Starting recurring invoice processing', { count: recurringInvoices.length });

    // Get org_id from the first invoice for logging
    const orgId = recurringInvoices[0].org_id;

    await writeLog(adminSupabase, orgId, 'processing_started', 'info',
      `Processing ${recurringInvoices.length} due recurring invoice(s)`,
      { metadata: { count: recurringInvoices.length, date: today } }
    );

    const results: Record<string, unknown>[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const recurring of recurringInvoices) {
      const client = recurring.clients;
      const recurringId = recurring.id;

      try {
        // --- Check end date ---
        if (recurring.end_date && new Date(recurring.end_date) < new Date()) {
          await adminSupabase
            .from('recurring_invoices')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', recurringId);

          log('info', 'Recurring invoice completed (end date reached)', { recurringId });
          await writeLog(adminSupabase, recurring.org_id, 'completed', 'info',
            `Recurring invoice for ${client?.name || 'unknown'} completed — end date reached`,
            { recurringInvoiceId: recurringId, metadata: { end_date: recurring.end_date } }
          );
          results.push({ recurring_invoice_id: recurringId, status: 'completed', message: 'End date reached' });
          continue;
        }

        // --- Idempotency: skip if invoice already exists for this billing period ---
        const { data: existing } = await adminSupabase
          .from('invoices')
          .select('id')
          .eq('recurring_invoice_id', recurringId)
          .gte('issued_at', `${recurring.next_invoice_date}T00:00:00`)
          .lte('issued_at', `${recurring.next_invoice_date}T23:59:59`)
          .limit(1);

        if (existing && existing.length > 0) {
          log('warn', 'Invoice already exists for this billing period, skipping', {
            recurringId,
            existingInvoiceId: existing[0].id,
            billingDate: recurring.next_invoice_date,
          });
          await writeLog(adminSupabase, recurring.org_id, 'skipped', 'skipped',
            `Invoice for ${client?.name || 'unknown'} already exists for billing date ${recurring.next_invoice_date}`,
            { recurringInvoiceId: recurringId, invoiceId: existing[0].id, metadata: { billing_date: recurring.next_invoice_date } }
          );
          results.push({ recurring_invoice_id: recurringId, status: 'skipped', message: 'Already processed' });
          continue;
        }

        if (!client?.email) {
          log('warn', 'Client has no email, skipping', { recurringId, clientId: recurring.client_id });
          await writeLog(adminSupabase, recurring.org_id, 'skipped', 'failed',
            `Skipped invoice for client ${recurring.client_id} — no email address on file`,
            { recurringInvoiceId: recurringId }
          );
          results.push({ recurring_invoice_id: recurringId, status: 'skipped', message: 'Client has no email' });
          errorCount++;
          continue;
        }

        log('info', 'Processing recurring invoice', { recurringId, clientName: client.name });

        // --- Generate invoice number ---
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const invoiceNumber = `INV-${timestamp}${random}`;

        // --- Calculate due date ---
        const paymentTermsDays = parseInt(recurring.payment_terms || '30');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + paymentTermsDays);

        // --- Create invoice in database ---
        const accessToken = generateAccessToken();
        const invoiceData = {
          org_id: recurring.org_id,
          client_id: recurring.client_id,
          recurring_invoice_id: recurringId,
          status: 'sent',
          amount_cents: recurring.amount_cents,
          issued_at: new Date().toISOString(),
          due_at: dueDate.toISOString(),
          invoice_number: invoiceNumber,
          title: recurring.title,
          description: recurring.description,
          line_items: recurring.line_items,
          payment_terms: recurring.payment_terms,
          require_signature: recurring.require_signature,
          brand_logo_url: recurring.brand_logo_url,
          brand_primary: recurring.brand_primary,
          total_paid_cents: 0,
          remaining_balance_cents: recurring.amount_cents,
          access_token: accessToken,
        };

        const { data: newInvoice, error: invoiceError } = await adminSupabase
          .from('invoices')
          .insert(invoiceData)
          .select('*')
          .single();

        if (invoiceError || !newInvoice) {
          throw new Error(`Failed to create invoice: ${invoiceError?.message}`);
        }

        log('info', 'Invoice created in database', { invoiceId: newInvoice.id, invoiceNumber });
        await writeLog(adminSupabase, recurring.org_id, 'invoice_created', 'success',
          `Invoice ${invoiceNumber} created for ${client.name} — ${currency(recurring.amount_cents)}`,
          { recurringInvoiceId: recurringId, invoiceId: newInvoice.id, metadata: { invoice_number: invoiceNumber, amount_cents: recurring.amount_cents, client_name: client.name, client_email: client.email } }
        );

        // --- Create Stripe Payment Link (matches manual send flow) ---
        let stripePaymentLinkUrl: string | null = null;

        if (process.env.STRIPE_SECRET_KEY) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';

            const paymentLink = await stripe.paymentLinks.create({
              line_items: [
                {
                  price_data: {
                    currency: 'usd',
                    product_data: {
                      name: recurring.title || `Invoice ${invoiceNumber}`,
                      description: recurring.description || 'Professional web development services',
                      metadata: {
                        invoice_id: newInvoice.id,
                        client_id: client.id,
                        org_id: recurring.org_id,
                      },
                    },
                    unit_amount: recurring.amount_cents,
                  },
                  quantity: 1,
                },
              ],
              metadata: {
                invoice_id: newInvoice.id,
                client_id: client.id,
                org_id: recurring.org_id,
                invoice_number: invoiceNumber,
                client_email: client.email,
                client_name: client.name,
                amount_cents: recurring.amount_cents.toString(),
                source: 'recurring_invoice',
                recurring_invoice_id: recurringId,
                created_at: new Date().toISOString(),
              },
              payment_intent_data: {
                metadata: {
                  invoice_id: newInvoice.id,
                  client_id: client.id,
                  org_id: recurring.org_id,
                  invoice_number: invoiceNumber,
                  client_email: client.email,
                  client_name: client.name,
                  amount_cents: recurring.amount_cents.toString(),
                  source: 'recurring_invoice',
                  recurring_invoice_id: recurringId,
                  created_at: new Date().toISOString(),
                },
              },
              after_completion: {
                type: 'redirect',
                redirect: {
                  url: `${baseUrl}/invoice/${accessToken}?payment=success`,
                },
              },
            });

            stripePaymentLinkUrl = paymentLink.url;

            // Update invoice with Stripe payment link
            await adminSupabase
              .from('invoices')
              .update({
                stripe_payment_link: paymentLink.id,
                stripe_hosted_invoice_url: paymentLink.url,
                hosted_invoice_url: paymentLink.url,
              })
              .eq('id', newInvoice.id);

            log('info', 'Stripe payment link created', { invoiceId: newInvoice.id, paymentLinkId: paymentLink.id });
            await writeLog(adminSupabase, recurring.org_id, 'stripe_link_created', 'success',
              `Stripe payment link created for invoice ${invoiceNumber}`,
              { recurringInvoiceId: recurringId, invoiceId: newInvoice.id, metadata: { payment_link_id: paymentLink.id } }
            );
          } catch (stripeError) {
            log('error', 'Stripe payment link creation failed', {
              invoiceId: newInvoice.id,
              error: stripeError instanceof Error ? stripeError.message : String(stripeError),
            });
            await writeLog(adminSupabase, recurring.org_id, 'stripe_link_failed', 'failed',
              `Failed to create Stripe payment link for invoice ${invoiceNumber}: ${stripeError instanceof Error ? stripeError.message : String(stripeError)}`,
              { recurringInvoiceId: recurringId, invoiceId: newInvoice.id }
            );
            // Continue without Stripe — invoice still exists and can be paid via portal
          }
        }

        // --- Send email notification to client ---
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
        const secureInvoiceUrl = `${baseUrl}/invoice/${accessToken}`;

        try {
          await sendInvoiceEmail({
            to: client.email,
            clientName: client.name,
            invoiceNumber,
            invoiceUrl: secureInvoiceUrl,
            amount: currency(recurring.amount_cents),
            dueDate: dueDate.toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            }),
            requiresSignature: recurring.require_signature || false,
          });

          log('info', 'Invoice email sent to client', { invoiceId: newInvoice.id, clientEmail: client.email });
          await writeLog(adminSupabase, recurring.org_id, 'email_sent', 'success',
            `Invoice email sent to ${client.name} (${client.email})`,
            { recurringInvoiceId: recurringId, invoiceId: newInvoice.id, metadata: { client_email: client.email, invoice_number: invoiceNumber } }
          );
        } catch (emailError) {
          log('error', 'Failed to send invoice email', {
            invoiceId: newInvoice.id,
            clientEmail: client.email,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
          await writeLog(adminSupabase, recurring.org_id, 'email_failed', 'failed',
            `Failed to email invoice ${invoiceNumber} to ${client.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
            { recurringInvoiceId: recurringId, invoiceId: newInvoice.id, metadata: { client_email: client.email } }
          );
          // Don't fail the entire process — invoice is created and accessible via portal
        }

        // --- Log activity ---
        await adminSupabase
          .from('client_activity_log')
          .insert({
            invoice_id: newInvoice.id,
            client_id: client.id,
            activity_type: 'recurring_invoice_sent',
            activity_data: {
              recurring_invoice_id: recurringId,
              invoice_number: invoiceNumber,
              amount_cents: recurring.amount_cents,
              frequency: recurring.frequency,
              email_sent: true,
            },
          })
          .then(({ error: activityError }) => {
            if (activityError) {
              log('warn', 'Failed to log activity', { error: activityError.message });
            }
          });

        // --- Calculate next invoice date ---
        const nextDate = calculateNextInvoiceDate(
          new Date(recurring.next_invoice_date),
          recurring.frequency,
          recurring.day_of_month
        );

        // --- Update recurring invoice metadata ---
        await adminSupabase
          .from('recurring_invoices')
          .update({
            next_invoice_date: nextDate.toISOString().split('T')[0],
            total_invoices_sent: (recurring.total_invoices_sent || 0) + 1,
            last_invoice_sent_at: new Date().toISOString(),
            last_invoice_id: newInvoice.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recurringId);

        results.push({
          recurring_invoice_id: recurringId,
          invoice_id: newInvoice.id,
          invoice_number: invoiceNumber,
          client_name: client.name,
          client_email: client.email,
          amount: currency(recurring.amount_cents),
          next_invoice_date: nextDate.toISOString().split('T')[0],
          stripe_payment_link: stripePaymentLinkUrl ? true : false,
          email_sent: true,
          status: 'success',
        });

        successCount++;
      } catch (error) {
        log('error', 'Failed to process recurring invoice', {
          recurringId,
          clientName: client?.name,
          error: error instanceof Error ? error.message : String(error),
        });

        await writeLog(adminSupabase, recurring.org_id, 'error', 'failed',
          `Error processing invoice for ${client?.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
          { recurringInvoiceId: recurringId, metadata: { error: error instanceof Error ? error.message : String(error) } }
        );

        results.push({
          recurring_invoice_id: recurringId,
          client_name: client?.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;

    log('info', 'Recurring invoice processing complete', {
      successCount,
      errorCount,
      durationMs: duration,
    });

    await writeLog(adminSupabase, orgId, 'processing_completed', 'info',
      `Processing complete: ${successCount} successful, ${errorCount} errors (${duration}ms)`,
      { metadata: { successful: successCount, errors: errorCount, duration_ms: duration } }
    );

    return NextResponse.json({
      success: true,
      processed: successCount + errorCount,
      message: `Processed ${successCount + errorCount} recurring invoices`,
      summary: {
        total_processed: successCount + errorCount,
        successful: successCount,
        errors: errorCount,
        duration_ms: duration,
      },
      results,
    });
  } catch (error) {
    log('error', 'Fatal error in recurring invoice processing', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({
      error: 'Failed to process recurring invoices',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

function calculateNextInvoiceDate(currentDate: Date, frequency: string, dayOfMonth?: number): Date {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      if (dayOfMonth) {
        nextDate.setMonth(nextDate.getMonth() + 1);
        const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(dayOfMonth, lastDay));
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}

function generateAccessToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token + Date.now().toString(36);
}
