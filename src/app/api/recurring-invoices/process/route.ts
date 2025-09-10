import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

// This endpoint will be called by a cron job or manually to process recurring invoices
export async function POST(request: Request) {
  try {
    // Optional auth check - you might want to protect this with an API key
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = supabaseAdmin();

    // Get all recurring invoices that are due for processing
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
      .lte('next_invoice_date', new Date().toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching recurring invoices:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const recurringInvoice of recurringInvoices || []) {
      try {
        // Check if end_date has passed
        if (recurringInvoice.end_date && new Date(recurringInvoice.end_date) < new Date()) {
          // Mark as completed
          await adminSupabase
            .from('recurring_invoices')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', recurringInvoice.id);
          
          results.push({
            recurring_invoice_id: recurringInvoice.id,
            status: 'completed',
            message: 'Recurring invoice completed (end date reached)'
          });
          continue;
        }

        console.log(`Processing recurring invoice ${recurringInvoice.id} for client ${recurringInvoice.clients.name}`);

        // Generate invoice number
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const invoiceNumber = `INV-${timestamp}${random}`;

        // Create Stripe customer if needed
        let customerId = recurringInvoice.clients.stripe_customer_id;
        if (!customerId) {
          try {
            const customer = await stripe.customers.create({
              email: recurringInvoice.clients.email || undefined,
              name: recurringInvoice.clients.name || undefined,
              metadata: { 
                org_id: recurringInvoice.org_id,
                client_id: recurringInvoice.client_id 
              },
            });
            customerId = customer.id;

            // Update client with Stripe customer ID
            await adminSupabase
              .from('clients')
              .update({ stripe_customer_id: customerId })
              .eq('id', recurringInvoice.client_id);
          } catch (stripeError) {
            console.error('Error creating Stripe customer:', stripeError);
            // Continue without Stripe customer
          }
        }

        // Calculate payment terms
        const paymentTermsDays = parseInt(recurringInvoice.payment_terms || '30');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + paymentTermsDays);

        // Create the regular invoice in database
        const invoiceData = {
          org_id: recurringInvoice.org_id,
          client_id: recurringInvoice.client_id,
          recurring_invoice_id: recurringInvoice.id,
          status: 'sent',
          amount_cents: recurringInvoice.amount_cents,
          issued_at: new Date().toISOString(),
          due_at: dueDate.toISOString(),
          invoice_number: invoiceNumber,
          title: recurringInvoice.title,
          description: recurringInvoice.description,
          line_items: recurringInvoice.line_items,
          payment_terms: recurringInvoice.payment_terms,
          require_signature: recurringInvoice.require_signature,
          brand_logo_url: recurringInvoice.brand_logo_url,
          brand_primary: recurringInvoice.brand_primary,
          total_paid_cents: 0,
          remaining_balance_cents: recurringInvoice.amount_cents,
          access_token: generateAccessToken()
        };

        const { data: newInvoice, error: invoiceError } = await adminSupabase
          .from('invoices')
          .insert(invoiceData)
          .select('*')
          .single();

        if (invoiceError) {
          throw new Error(`Failed to create invoice: ${invoiceError.message}`);
        }

        // Create Stripe invoice if customer exists
        let stripeInvoiceId = null;
        if (customerId) {
          try {
            // Create Stripe invoice
            const stripeInvoice = await stripe.invoices.create({
              customer: customerId,
              collection_method: "send_invoice",
              days_until_due: paymentTermsDays,
              description: recurringInvoice.description || undefined,
              metadata: {
                org_id: recurringInvoice.org_id,
                client_id: recurringInvoice.client_id,
                invoice_id: newInvoice.id,
                recurring_invoice_id: recurringInvoice.id,
                invoice_number: invoiceNumber,
              },
            });

            // Add line items to Stripe invoice
            const lineItems = recurringInvoice.line_items as any[];
            for (const item of lineItems) {
              await stripe.invoiceItems.create({
                customer: customerId,
                invoice: stripeInvoice.id,
                amount: item.amount_cents,
                currency: 'usd',
                description: item.description,
              });
            }

            // Finalize and send the invoice
            if (stripeInvoice.id) {
              await stripe.invoices.finalizeInvoice(stripeInvoice.id);
              await stripe.invoices.sendInvoice(stripeInvoice.id);
            }

            stripeInvoiceId = stripeInvoice.id;

            // Update invoice with Stripe ID
            await adminSupabase
              .from('invoices')
              .update({ 
                stripe_invoice_id: stripeInvoiceId,
                hosted_invoice_url: stripeInvoice.hosted_invoice_url 
              })
              .eq('id', newInvoice.id);

          } catch (stripeError) {
            console.error('Error with Stripe invoice:', stripeError);
            // Continue - the invoice is still created in our database
          }
        }

        // Calculate next invoice date
        const nextDate = calculateNextInvoiceDate(
          new Date(recurringInvoice.next_invoice_date),
          recurringInvoice.frequency,
          recurringInvoice.day_of_month
        );

        // Update recurring invoice
        await adminSupabase
          .from('recurring_invoices')
          .update({
            next_invoice_date: nextDate.toISOString().split('T')[0],
            total_invoices_sent: (recurringInvoice.total_invoices_sent || 0) + 1,
            last_invoice_sent_at: new Date().toISOString(),
            last_invoice_id: newInvoice.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', recurringInvoice.id);

        results.push({
          recurring_invoice_id: recurringInvoice.id,
          invoice_id: newInvoice.id,
          invoice_number: invoiceNumber,
          client_name: recurringInvoice.clients.name,
          amount: `$${(recurringInvoice.amount_cents / 100).toFixed(2)}`,
          next_invoice_date: nextDate.toISOString().split('T')[0],
          stripe_invoice_id: stripeInvoiceId,
          status: 'success'
        });

        successCount++;

      } catch (error) {
        console.error(`Error processing recurring invoice ${recurringInvoice.id}:`, error);
        results.push({
          recurring_invoice_id: recurringInvoice.id,
          client_name: recurringInvoice.clients.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount + errorCount} recurring invoices`,
      summary: {
        total_processed: successCount + errorCount,
        successful: successCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    console.error('Error in recurring invoice processing:', error);
    return NextResponse.json({
      error: 'Failed to process recurring invoices',
      details: error instanceof Error ? error.message : String(error)
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
        // Move to next month first
        nextDate.setMonth(nextDate.getMonth() + 1);
        // Set to specific day of month
        nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
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
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}