import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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
    // First, get all invoices with their payments and client info for this org
    const { data: invoicesWithPayments, error } = await gate.supabase
      .from('invoices')
      .select(`
        id,
        description,
        invoice_number,
        client_id,
        clients!client_id (
          id,
          name
        ),
        invoice_payments (
          id,
          amount_cents,
          paid_at,
          payment_method,
          stripe_payment_intent_id,
          metadata
        )
      `)
      .eq('org_id', gate.orgId)
      .not('invoice_payments.id', 'is', null);

    if (error) {
      console.error('Error fetching invoices with payments:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Flatten the data structure to get individual payments
    const allPayments: any[] = [];
    invoicesWithPayments?.forEach(invoice => {
      if (invoice.invoice_payments && invoice.clients) {
        invoice.invoice_payments.forEach(payment => {
          allPayments.push({
            ...payment,
            invoice: {
              id: invoice.id,
              description: invoice.description,
              invoice_number: invoice.invoice_number,
              client: Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
            }
          });
        });
      }
    });

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