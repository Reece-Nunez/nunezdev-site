import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import type { CreateInvoiceData, InvoiceLineItem } from "@/types/invoice";

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

function calculateInvoiceTotals(line_items: InvoiceLineItem[]) {
  const subtotal_cents = line_items.reduce((sum, item) => sum + item.amount_cents, 0);
  const tax_cents = 0; // TODO: Implement tax calculation based on client location
  const discount_cents = 0; // TODO: Implement discount logic
  const total_cents = subtotal_cents + tax_cents - discount_cents;
  
  return { subtotal_cents, tax_cents, discount_cents, total_cents };
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

async function createStripeInvoice(
  client: any, 
  invoiceData: CreateInvoiceData, 
  total_cents: number,
  orgId: string
) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Get or create Stripe customer
  let customerId: string | undefined = client.stripe_customer_id ?? undefined;
  if (!customerId) {
    if (client.email) {
      try {
        const found = await stripe.customers.search({ query: `email:'${client.email}'`, limit: 1 });
        customerId = found.data[0]?.id;
      } catch {
        /* ignore */
      }
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        email: client.email ?? undefined,
        name: client.name ?? undefined,
        metadata: { orgId, app_client_id: client.id },
      });
      customerId = created.id;
    }
  }

  const daysUntilDue = getPaymentTermsDays(invoiceData.payment_terms);

  // Create draft invoice
  const draft = await stripe.invoices.create({
    customer: customerId!,
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    description: invoiceData.description || undefined,
    auto_advance: !invoiceData.send_immediately, // Don't auto-advance if sending immediately
    metadata: {
      orgId,
      clientId: client.id,
      require_signature: invoiceData.require_signature ? "1" : "0",
      invoice_title: invoiceData.title || "",
    },
  });

  // Add line items to invoice
  for (const item of invoiceData.line_items) {
    await stripe.invoiceItems.create({
      customer: customerId!,
      invoice: draft.id,
      currency: "usd",
      amount: item.amount_cents,
      quantity: item.quantity,
      description: item.description,
      metadata: { orgId, clientId: client.id },
    });
  }

  // Send invoice if requested
  let finalInvoice = draft;
  if (invoiceData.send_immediately) {
    finalInvoice = await stripe.invoices.sendInvoice(draft.id);
  }

  return { invoice: finalInvoice, customerId };
}

/** POST: Create a new invoice with line items */
export async function POST(req: Request) {
  try {
    const invoiceData: CreateInvoiceData = await req.json();

    // Validate required fields
    if (!invoiceData.client_id || !invoiceData.line_items || invoiceData.line_items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate line items
    for (const item of invoiceData.line_items) {
      if (!item.description || item.quantity <= 0 || item.rate_cents <= 0) {
        return NextResponse.json({ error: "Invalid line item data" }, { status: 400 });
      }
      // Ensure amount_cents is calculated correctly
      item.amount_cents = Math.round(item.quantity * item.rate_cents);
    }

    // Calculate totals
    const { subtotal_cents, tax_cents, discount_cents, total_cents } = calculateInvoiceTotals(invoiceData.line_items);

    if (total_cents <= 0) {
      return NextResponse.json({ error: "Invoice total must be greater than $0" }, { status: 400 });
    }

    // Auth + org
    const gate = await requireAuthedOrgId();
    if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
    const { supabase, orgId } = gate;

    // Fetch client
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, email, stripe_customer_id")
      .eq("id", invoiceData.client_id)
      .eq("org_id", orgId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Generate invoice number and access token
    const invoiceNumber = `INV-${Date.now()}`;
    const accessToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    // Determine due date
    const daysUntilDue = getPaymentTermsDays(invoiceData.payment_terms);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysUntilDue);

    // Create invoice in database first (as draft)
    const insertPayload = {
      org_id: orgId,
      client_id: client.id,
      status: invoiceData.send_immediately ? 'sent' : 'draft',
      invoice_number: invoiceNumber,
      access_token: accessToken,
      title: invoiceData.title,
      description: invoiceData.description,
      notes: invoiceData.notes,
      amount_cents: total_cents,
      subtotal_cents,
      tax_cents,
      discount_cents,
      line_items: invoiceData.line_items,
      payment_terms: invoiceData.payment_terms,
      require_signature: invoiceData.require_signature,
      currency_code: 'USD',
      issued_at: invoiceData.send_immediately ? new Date().toISOString() : null,
      due_at: invoiceData.send_immediately ? dueDate.toISOString() : null,
      brand_logo_url: invoiceData.brand_logo_url,
      brand_primary: invoiceData.brand_primary,
    };

    const { data: dbInvoice, error: dbError } = await supabase
      .from("invoices")
      .insert(insertPayload)
      .select(`
        id, client_id, status, amount_cents, issued_at, due_at,
        invoice_number, title, description, line_items, payment_terms,
        clients!inner(id, name, email, phone, company)
      `)
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    let stripeInvoiceUrl = null;
    let agreementUrl = null;

    // Create Stripe invoice if sending immediately
    if (invoiceData.send_immediately) {
      try {
        const { invoice: stripeInvoice } = await createStripeInvoice(
          client, 
          invoiceData, 
          total_cents, 
          orgId
        );

        // Update database with Stripe ID
        await supabase
          .from("invoices")
          .update({ 
            stripe_invoice_id: stripeInvoice.id,
            hosted_invoice_url: stripeInvoice.hosted_invoice_url 
          })
          .eq("id", dbInvoice.id);

        stripeInvoiceUrl = stripeInvoice.hosted_invoice_url;
      } catch (stripeError) {
        console.error("Stripe error:", stripeError);
        // Don't fail the request - invoice is created locally
      }
    }

    // Generate agreement URL if signature required
    if (invoiceData.require_signature) {
      agreementUrl = `/invoices/${dbInvoice.id}/agreement`;
      
      // Update with hosted invoice URL for signature flow
      await supabase
        .from("invoices")
        .update({ hosted_invoice_url: agreementUrl })
        .eq("id", dbInvoice.id);
    }

    return NextResponse.json({
      invoice: dbInvoice,
      stripe_invoice_url: stripeInvoiceUrl,
      agreement_url: agreementUrl,
      message: invoiceData.send_immediately 
        ? "Invoice created and sent successfully!" 
        : "Invoice created as draft. You can edit and send it later."
    });

  } catch (err: unknown) {
    console.error("Invoice creation error:", err);
    const msg = err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message)
      : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET: List all invoices with filtering */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'all';
  const clientId = url.searchParams.get('client_id');
  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');
  const search = url.searchParams.get('q');

  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  let query = gate.supabase
    .from("invoices")
    .select(`
      id, client_id, status, amount_cents, issued_at, due_at, created_at,
      invoice_number, title, stripe_invoice_id, signed_at, hosted_invoice_url,
      clients!inner(id, name, email, phone, company)
    `)
    .eq("org_id", gate.orgId)
    .order("created_at", { ascending: false });

  // Apply filters
  if (status !== 'all') {
    query = query.eq('status', status);
  }
  
  if (clientId) {
    query = query.eq('client_id', clientId);
  }
  
  if (fromDate) {
    query = query.gte('created_at', fromDate);
  }
  
  if (toDate) {
    query = query.lte('created_at', toDate);
  }

  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Apply search filter (client name or email)
  let filteredData = data || [];
  if (search) {
    const searchLower = search.toLowerCase();
    filteredData = filteredData.filter(invoice => 
      invoice.clients?.name?.toLowerCase().includes(searchLower) ||
      invoice.clients?.email?.toLowerCase().includes(searchLower) ||
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.title?.toLowerCase().includes(searchLower)
    );
  }

  return NextResponse.json({ invoices: filteredData });
}
