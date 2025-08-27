import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function mapStripeToDbStatus(s?: Stripe.Invoice.Status | null) {
  switch (s) {
    case "draft": return "draft";
    case "open": return "sent";
    case "paid": return "paid";
    case "void": return "void";
    case "uncollectible": return "overdue";
    default: return "draft";
  }
}

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

/** GET: list invoices for this client (scoped by org) */
export async function GET(_req: Request, ctx: Ctx) {
  const { id: clientId } = await ctx.params;
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { data, error } = await gate.supabase
    .from("invoices")
    .select("id, client_id, status, amount_cents, issued_at, due_at, stripe_invoice_id")
    .eq("org_id", gate.orgId)
    .eq("client_id", clientId)
    .order("issued_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invoices: data ?? [] });
}

/** POST: create & send a Stripe invoice for this client, then mirror to DB */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: clientId } = await ctx.params;
    const payload = await req.json();

    // Validate amount
    const amount_cents = Number(payload.amount_cents);
    if (!Number.isFinite(amount_cents) || amount_cents <= 0) {
      return NextResponse.json({ error: "Invalid amount_cents" }, { status: 400 });
    }

    // Optional fields (kept small; long text goes to DB columns)
    const description: string | undefined =
      typeof payload.description === "string" && payload.description.trim()
        ? payload.description.trim().slice(0, 5000)
        : undefined;

    const scope_notes: string | undefined =
      typeof payload.scope_notes === "string" && payload.scope_notes.trim()
        ? payload.scope_notes.trim()
        : undefined;

    const terms: string | undefined =
      typeof payload.terms === "string" && payload.terms.trim()
        ? payload.terms.trim().slice(0, 5000)
        : undefined;

    const days_until_due = Number.isFinite(payload.days_until_due)
      ? Math.max(1, Math.min(90, Number(payload.days_until_due)))
      : 7;

    const require_signature = Boolean(payload.require_signature);
    const brand_logo_url =
      typeof payload.brand_logo_url === "string" && payload.brand_logo_url.trim()
        ? payload.brand_logo_url.trim()
        : undefined;
    const brand_primary =
      typeof payload.brand_primary === "string" && /^#?[0-9a-fA-F]{6}$/.test(payload.brand_primary)
        ? (payload.brand_primary.startsWith("#") ? payload.brand_primary : `#${payload.brand_primary}`)
        : undefined;

    // Auth + org
    const gate = await requireAuthedOrgId();
    if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
    const { supabase, orgId } = gate;

    // Fetch client in-org
    type Client = {
      id: string;
      name: string | null;
      email: string | null;
      stripe_customer_id?: string | null;
    };
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, email, stripe_customer_id")
      .eq("id", clientId)
      .eq("org_id", orgId)
      .single<Client>();

    if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 400 });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    // Stripe setup
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Get or create customer
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

        // Best-effort persist; ignore failure if column doesn't exist
        await supabase
          .from("clients")
          .update({ stripe_customer_id: customerId } as Partial<Pick<Client, "stripe_customer_id">>)
          .eq("id", client.id)
          .eq("org_id", orgId);
      }
    }

    // Create draft invoice
    const draft = await stripe.invoices.create({
      customer: customerId!,
      collection_method: "send_invoice",
      days_until_due,
      description: description || undefined,
      auto_advance: true,
      metadata: {
        orgId,
        clientId: client.id,
        require_signature: require_signature ? "1" : "0",
        brand_logo_url: brand_logo_url || "",
        brand_primary: brand_primary || "",
      },
    });
    if (!draft?.id) {
      return NextResponse.json({ error: "Failed to create Stripe invoice" }, { status: 502 });
    }

    // Attach a line item TO THIS INVOICE (prevents $0 invoices)
    await stripe.invoiceItems.create({
      customer: customerId!,
      invoice: draft.id,
      currency: "usd",
      amount: amount_cents,
      description: description || "Services",
      metadata: { orgId, clientId: client.id },
    });

    // Finalize + send (emails must be enabled in Stripe Dashboard)
    const sent = await stripe.invoices.sendInvoice(draft.id);

    // Mirror to DB
    const dbStatus = mapStripeToDbStatus(sent.status);
    const cents = sent.amount_due ?? sent.total ?? amount_cents;

    type InvoiceInsertPayload = {
      org_id: string;
      client_id: string;
      stripe_invoice_id: string;
      status: string;
      amount_cents: number;
      issued_at: string;
      due_at: string | null;
      description?: string | null;
      scope_notes?: string | null;
      terms?: string | null;
      require_signature?: boolean;
      brand_logo_url?: string | null;
      brand_primary?: string | null;
    };

    const insertPayload: InvoiceInsertPayload = {
      org_id: orgId,
      client_id: client.id,
      stripe_invoice_id: sent.id!,
      status: dbStatus,
      amount_cents: cents,
      issued_at: sent.status_transitions?.finalized_at
        ? new Date(sent.status_transitions.finalized_at * 1000).toISOString()
        : new Date().toISOString(),
      due_at: sent.due_date ? new Date(sent.due_date * 1000).toISOString() : null,
      // Extended fields (if your schema has them)
      description: description ?? null,
      scope_notes: scope_notes ?? null,
      terms: terms ?? null,
      require_signature,
      brand_logo_url: brand_logo_url ?? null,
      brand_primary: brand_primary ?? null,
    };

    const { data: mirrored, error: dbError } = await supabase
      .from("invoices")
      .insert(insertPayload)
      .select("id, client_id, status, amount_cents, issued_at, due_at, stripe_invoice_id")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

    const agreement_url =
      require_signature && mirrored?.id ? `/invoices/${mirrored.id}/agreement` : null;

    return NextResponse.json({
      invoice: mirrored,
      hosted_invoice_url: sent.hosted_invoice_url,
      agreement_url,
    });
  } catch (err: unknown) {
    const msg = err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message)
      : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE: void in Stripe (if not paid) and delete row in DB */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id: clientId } = await ctx.params;
  const { id: invoiceId, hard = true } = await req.json();

  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
  const { supabase, orgId } = gate;

  // Fetch invoice row (scoped to org + client)
  const { data: row, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, stripe_invoice_id, status")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .single();

  if (fetchErr || !row) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (hard && row.stripe_invoice_id) {
    // Void in Stripe unless it's paid
    if (row.status === "paid") {
      return NextResponse.json({ error: "Paid invoices cannot be deleted." }, { status: 409 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    try {
      await stripe.invoices.voidInvoice(row.stripe_invoice_id);
    } catch (e: unknown) {
      const errorMessage = e && typeof e === "object" && "message" in e
        ? (e as { message?: string }).message
        : "Stripe void failed";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  }

  const { error: delErr } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .eq("client_id", clientId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
