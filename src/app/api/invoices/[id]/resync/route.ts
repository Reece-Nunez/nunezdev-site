import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function mapStatus(s?: Stripe.Invoice.Status | null) {
  switch (s) {
    case "draft": return "draft";
    case "open": return "sent";
    case "paid": return "paid";
    case "void": return "void";
    case "uncollectible": return "overdue";
    default: return "draft";
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  // auth as the user so only owners can resync
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data: row } = await supabase
    .from("invoices")
    .select("id, stripe_invoice_id")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (!row?.stripe_invoice_id) return NextResponse.json({ error: "Missing stripe_invoice_id" }, { status: 404 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const si = await stripe.invoices.retrieve(row.stripe_invoice_id);

  const admin = supabaseAdmin();
  const payload = {
    status: mapStatus(si.status),
    amount_cents: (si.total ?? si.amount_due ?? 0),
    issued_at: si.status_transitions?.finalized_at ? new Date(si.status_transitions.finalized_at * 1000).toISOString() : null,
    due_at: si.due_date ? new Date(si.due_date * 1000).toISOString() : null,
  };

  const { data: updated, error } = await admin
    .from("invoices")
    .update(payload)
    .eq("id", id)
    .select("id,status,amount_cents,issued_at,due_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invoice: updated });
}
