import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendBusinessNotification, sendPaymentReceipt } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuthedOrgId() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" as const } };

  const { data: m, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (error) return { ok: false as const, status: 400 as const, json: { error: error.message } };
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" as const } };

  return { ok: true as const, supabase, orgId, user };
}

export async function GET(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get('sort') || 'date';
  const sortOrder = searchParams.get('order') || 'desc';
  const filterBy = searchParams.get('filter') || 'all';
  const clientFilter = searchParams.get('client') || '';

  try {
    // Query payments directly with joined invoice and client data
    const { data: paymentsData, error } = await gate.supabase
      .from('invoice_payments')
      .select(`
        id,
        amount_cents,
        paid_at,
        payment_method,
        stripe_payment_intent_id,
        metadata,
        invoices!invoice_id (
          id,
          description,
          invoice_number,
          client_id,
          org_id,
          clients!client_id (
            id,
            name
          )
        )
      `)
      .eq('invoices.org_id', gate.orgId);

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Transform the data structure to match the expected format
    const allPayments: any[] = paymentsData?.map(payment => ({
      ...payment,
      invoice: {
        id: (payment.invoices as any).id,
        description: (payment.invoices as any).description,
        invoice_number: (payment.invoices as any).invoice_number,
        client: Array.isArray((payment.invoices as any).clients) ? (payment.invoices as any).clients[0] : (payment.invoices as any).clients
      }
    })) || [];

    // Apply filters
    let filteredPayments = allPayments;
    
    if (filterBy !== 'all') {
      if (filterBy === 'stripe') {
        filteredPayments = filteredPayments.filter(p => p.stripe_payment_intent_id);
      } else {
        filteredPayments = filteredPayments.filter(p => p.payment_method === filterBy);
      }
    }

    if (clientFilter) {
      filteredPayments = filteredPayments.filter(p => p.invoice.client?.name === clientFilter);
    }

    // Apply sorting
    filteredPayments.sort((a, b) => {
      let valueA, valueB;
      
      if (sortBy === 'amount') {
        valueA = a.amount_cents || 0;
        valueB = b.amount_cents || 0;
      } else if (sortBy === 'client') {
        valueA = a.invoice.client?.name || '';
        valueB = b.invoice.client?.name || '';
      } else { // date
        valueA = new Date(a.paid_at).getTime();
        valueB = new Date(b.paid_at).getTime();
      }

      if (sortOrder === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    // Calculate summary
    const totalAmount = filteredPayments.reduce((sum, payment) => sum + (payment.amount_cents || 0), 0);
    const paymentCount = filteredPayments.length;

    return NextResponse.json({
      payments: filteredPayments,
      summary: {
        totalAmount,
        paymentCount
      }
    });

  } catch (error: unknown) {
    console.error("Failed to fetch payments:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  // Use admin client for payment operations to bypass RLS
  const adminSupabase = supabaseAdmin();

  try {
    const { 
      invoice_id, 
      amount_cents, 
      payment_method, 
      paid_at, 
      notes,
      manual 
    } = await request.json();

    console.log(`Creating manual payment: ${amount_cents} cents for invoice ${invoice_id}`);

    // Validate required fields
    if (!invoice_id || !amount_cents || !payment_method || !paid_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (amount_cents <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 });
    }

    // Get the invoice details and verify it belongs to the user's org
    const { data: invoice, error: invoiceError } = await adminSupabase
      .from('invoices')
      .select('id, invoice_number, amount_cents, status, client_id, total_paid_cents, remaining_balance_cents, clients(name, email)')
      .eq('id', invoice_id)
      .eq('org_id', gate.orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Create the payment record
    const paymentData = {
      invoice_id: invoice.id,
      amount_cents: amount_cents,
      paid_at: new Date(paid_at).toISOString(),
      payment_method: payment_method,
      metadata: {
        source: 'manual_payment',
        created_manually: true,
        created_at: new Date().toISOString(),
        invoice_number: invoice.invoice_number,
        notes: notes || '',
        note: 'Payment created manually via dashboard'
      }
    };

    const { data: newPayment, error: paymentError } = await adminSupabase
      .from('invoice_payments')
      .insert(paymentData)
      .select('*')
      .single();

    if (paymentError) {
      console.error('Failed to create payment:', paymentError);
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    // Calculate new invoice totals
    const { data: allPayments } = await adminSupabase
      .from('invoice_payments')
      .select('amount_cents')
      .eq('invoice_id', invoice.id);

    const totalPaidCents = (allPayments || []).reduce((sum, p) => sum + p.amount_cents, 0);
    const remainingBalanceCents = Math.max(invoice.amount_cents - totalPaidCents, 0);
    
    // Determine new status based on payment totals
    let newStatus = 'sent';
    if (totalPaidCents >= invoice.amount_cents) {
      newStatus = 'paid';
    } else if (totalPaidCents > 0) {
      newStatus = 'partially_paid';
    }

    // Update invoice totals to reflect the payment
    const { data: updatedInvoice, error: updateError } = await adminSupabase
      .from('invoices')
      .update({
        status: newStatus,
        total_paid_cents: totalPaidCents,
        remaining_balance_cents: remainingBalanceCents,
        paid_at: newStatus === 'paid' ? paymentData.paid_at : null
      })
      .eq('id', invoice.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update invoice:', updateError);
    }

    // Send notifications (fire-and-forget, don't block response)
    const clientData = invoice.clients as any;
    const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
    const clientEmail = Array.isArray(clientData) ? clientData[0]?.email : clientData?.email;

    sendBusinessNotification('payment_received', {
      invoice_id: invoice.id,
      client_name: clientName || 'Unknown',
      invoice_number: invoice.invoice_number,
      amount_cents: amount_cents,
      payment_method: payment_method,
    }).catch(err => console.error('[payments] Business notification error:', err));

    if (clientEmail) {
      sendPaymentReceipt({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: clientName || 'Client',
        client_email: clientEmail,
        amount_cents: amount_cents,
        total_paid_cents: totalPaidCents,
        invoice_total_cents: invoice.amount_cents,
        remaining_balance_cents: remainingBalanceCents,
        payment_method: payment_method,
        payment_date: paid_at,
      }).catch(err => console.error('[payments] Client receipt error:', err));
    }

    const result = {
      success: true,
      message: `Manual payment of $${(amount_cents / 100).toFixed(2)} created for invoice ${invoice.invoice_number}`,
      payment: newPayment,
      invoice: updatedInvoice || invoice
    };

    console.log('Manual payment created:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Manual payment creation error:', error);
    return NextResponse.json({
      error: 'Payment creation failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}