import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientName = searchParams.get('name');

  const supabase = await supabaseServer();
  
  // Use known org_id for debugging (from debug/payments route)
  const orgId = "38a6ef02-f4dc-43c8-b5ce-bebbb8ff4728";
  
  if (!clientName) {
    // List all clients if no name provided
    const { data: allClients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, email, company")
      .eq("org_id", orgId)
      .limit(20);

    // Also check if there are ANY clients in the database
    const { data: anyClients, error: anyError } = await supabase
      .from("clients")
      .select("id, name, email, company, org_id")
      .limit(5);

    // Check the clients_overview view that we know works
    const { data: overviewClients, error: overviewError } = await supabase
      .from("clients_overview")
      .select("id, name, email, company, org_id, total_invoiced_cents, total_paid_cents, balance_due_cents")
      .eq("org_id", orgId)
      .limit(10);
    
    return NextResponse.json({ 
      message: "Please provide ?name=ClientName", 
      orgId,
      available_clients: allClients?.map(c => ({ name: c.name, email: c.email, company: c.company })) || [],
      clients_error: clientsError?.message,
      any_clients_in_db: anyClients?.map(c => ({ name: c.name, email: c.email, company: c.company, org_id: c.org_id })) || [],
      any_clients_error: anyError?.message,
      overview_clients: overviewClients || [],
      overview_error: overviewError?.message
    });
  }

  try {
    // Get client basic info from overview (which we know works)
    const { data: clients, error: clientError } = await supabase
      .from("clients_overview")
      .select("id, name, email, company")
      .eq("org_id", orgId)
      .ilike("name", `%${clientName}%`);

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 400 });
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = clients[0];

    // Get all invoices for this client
    const { data: invoices, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, status, amount_cents, issued_at, due_at, description, invoice_number")
      .eq("client_id", client.id)
      .order("issued_at", { ascending: false });

    // Also check if there are ANY invoices for ANY clients (to see if table is empty)
    const { data: anyInvoices, error: anyInvoiceError } = await supabase
      .from("invoices")
      .select("id, client_id, status, amount_cents, org_id")
      .limit(10);

    // Check for this specific client without org_id filter
    const { data: clientInvoicesNoFilter, error: noFilterError } = await supabase
      .from("invoices")
      .select("id, status, amount_cents, issued_at, description, org_id")
      .eq("client_id", client.id);

    // Check specific invoice IDs from debug logs
    const knownInvoiceIds = [
      "1a7d1c82-89e5-42dd-b559-21e75e532f40", // The Rapid Rescore
      "724722c2-fd22-44d3-be97-b35a5b6d328b", // Custom Website
      "d5adf9aa-88d3-455a-8e7b-e7d7218c92e9", // Nooqbook updates
      "af03574c-2c96-49f2-acca-80d1fde9500a"  // Alphonse Bosque - Artisan Construction
    ];
    
    const { data: knownInvoices, error: knownError } = await supabase
      .from("invoices")
      .select("id, client_id, status, amount_cents, invoice_number")
      .in("id", knownInvoiceIds);

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 400 });
    }

    // Get payments for this client's invoices
    const invoiceIds = invoices?.map(inv => inv.id) || [];
    let payments = [];
    if (invoiceIds.length > 0) {
      const { data: paymentData, error: paymentError } = await supabase
        .from("invoice_payments")
        .select("invoice_id, amount_cents, paid_at, payment_method")
        .in("invoice_id", invoiceIds);
      
      if (!paymentError) {
        payments = paymentData || [];
      }
    }

    // Get overview data for comparison (already have from clients query above)
    const overview = clients.find(c => c.id === client.id);
    const { data: fullOverview, error: overviewError } = await supabase
      .from("clients_overview")
      .select("total_invoiced_cents, total_paid_cents, balance_due_cents")
      .eq("id", client.id)
      .single();

    // Calculate totals manually
    const manualTotals = invoices?.reduce((acc, inv) => {
      if (inv.status === 'sent' || inv.status === 'paid' || inv.status === 'overdue') {
        acc.total_invoiced += inv.amount_cents;
      }
      return acc;
    }, { total_invoiced: 0, total_paid: 0 }) || { total_invoiced: 0, total_paid: 0 };

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    manualTotals.total_paid = totalPaid;

    // Group invoices by status
    const invoicesByStatus = invoices?.reduce((acc, inv) => {
      if (!acc[inv.status]) acc[inv.status] = [];
      acc[inv.status].push({
        id: inv.id,
        amount_cents: inv.amount_cents,
        amount_usd: (inv.amount_cents / 100).toFixed(2),
        issued_at: inv.issued_at,
        description: inv.description,
        invoice_number: inv.invoice_number
      });
      return acc;
    }, {} as Record<string, any[]>) || {};

    return NextResponse.json({
      client,
      overview_data: fullOverview,
      overview_error: overviewError?.message,
      manual_calculation: {
        total_invoiced_cents: manualTotals.total_invoiced,
        total_paid_cents: manualTotals.total_paid,
        balance_due_cents: manualTotals.total_invoiced - manualTotals.total_paid,
        total_invoiced_usd: (manualTotals.total_invoiced / 100).toFixed(2),
        total_paid_usd: (manualTotals.total_paid / 100).toFixed(2),
        balance_due_usd: ((manualTotals.total_invoiced - manualTotals.total_paid) / 100).toFixed(2)
      },
      discrepancy: fullOverview ? {
        invoiced_diff: manualTotals.total_invoiced - fullOverview.total_invoiced_cents,
        paid_diff: manualTotals.total_paid - fullOverview.total_paid_cents,
        balance_diff: (manualTotals.total_invoiced - manualTotals.total_paid) - fullOverview.balance_due_cents
      } : null,
      invoices_by_status: invoicesByStatus,
      all_invoices: invoices,
      payments,
      any_invoices_in_org: anyInvoices || [],
      any_invoice_error: anyInvoiceError?.message,
      known_invoices: knownInvoices || [],
      known_invoices_error: knownError?.message,
      client_invoices_no_filter: clientInvoicesNoFilter || [],
      no_filter_error: noFilterError?.message
    });

  } catch (error) {
    return NextResponse.json({ 
      error: "Database query failed", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}