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

/** GET: Get invoice summaries by client for a given year */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10);

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
  }

  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
  const { supabase, orgId } = gate;

  // Fetch all invoices for the year, grouped by client
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  const { data: invoices, error: invoiceErr } = await supabase
    .from("invoices")
    .select(`
      id,
      client_id,
      amount_cents,
      total_paid_cents
    `)
    .eq("org_id", orgId)
    .gte("issued_at", startDate)
    .lte("issued_at", endDate)
    .neq("status", "draft")
    .neq("status", "void");

  if (invoiceErr) {
    return NextResponse.json({ error: invoiceErr.message }, { status: 400 });
  }

  // Aggregate by client
  const clientSummaries = new Map<string, {
    client_id: string;
    invoice_count: number;
    total_invoiced: number;
    total_paid: number;
  }>();

  (invoices || []).forEach(inv => {
    const existing = clientSummaries.get(inv.client_id);
    if (existing) {
      existing.invoice_count += 1;
      existing.total_invoiced += inv.amount_cents || 0;
      existing.total_paid += inv.total_paid_cents || 0;
    } else {
      clientSummaries.set(inv.client_id, {
        client_id: inv.client_id,
        invoice_count: 1,
        total_invoiced: inv.amount_cents || 0,
        total_paid: inv.total_paid_cents || 0,
      });
    }
  });

  return NextResponse.json({
    summaries: Array.from(clientSummaries.values()),
    year,
  });
}
