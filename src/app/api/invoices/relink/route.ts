import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelinkSummary = {
  scanned: number;
  updated: number;
  matched_by_meta: number;
  matched_by_email: number;
  already_linked: number;
  no_stripe_id: number;
  stripe_fetch_failed: number;
  skipped_no_match: number;
};

async function getOrgIdForUser() {
  const s = await supabaseServer();
  const { data: { user } } = await s.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: m } = await s.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id ?? null;
  if (!orgId) throw new Error("No org");
  return orgId;
}

/** GET = preview how many orphans exist (no changes) */
export async function GET() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  try {
    const orgId = await getOrgIdForUser();
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("invoices")
      .select("id, client_id, org_id, stripe_invoice_id")
      .or("client_id.is.null,org_id.is.null")
      .order("issued_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const counts = {
      total_orphans: data?.length ?? 0,
      missing_org: (data ?? []).filter(r => !r.org_id).length,
      missing_client: (data ?? []).filter(r => !r.client_id).length,
      missing_both: (data ?? []).filter(r => !r.org_id && !r.client_id).length,
      missing_stripe_id: (data ?? []).filter(r => !r.stripe_invoice_id).length,
    };

    return NextResponse.json({ ok: true, orgId, counts });
  } catch (e: unknown) {
    const message = typeof e === "object" && e !== null && "message" in e ? (e as { message?: string }).message : undefined;
    return NextResponse.json({ error: message ?? "Preview failed" }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

/** POST = attempt to relink */
export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "200");
  const adopt = url.searchParams.get("adopt") === "1";

  const summary: RelinkSummary = {
    scanned: 0,
    updated: 0,
    matched_by_meta: 0,
    matched_by_email: 0,
    already_linked: 0,
    no_stripe_id: 0,
    stripe_fetch_failed: 0,
    skipped_no_match: 0
  };

  try {
    const currentOrg = await getOrgIdForUser();
    const admin = supabaseAdmin();

    // Grab orphan invoices (within or lacking this org)
    const { data: rows, error } = await admin
      .from("invoices")
      .select("id, org_id, client_id, stripe_invoice_id")
      .or("client_id.is.null,org_id.is.null")
      .order("issued_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    for (const row of rows ?? []) {
      summary.scanned++;

      // Fast path: nothing missing
      if (row.org_id && row.client_id) {
        summary.already_linked++;
        continue;
      }

      if (!row.stripe_invoice_id) {
        summary.no_stripe_id++;
        continue;
      }

      // Fetch Stripe invoice
      let inv: Stripe.Invoice | null = null;
      try {
        inv = await stripe.invoices.retrieve(row.stripe_invoice_id);
      } catch {
        summary.stripe_fetch_failed++;
        continue;
      }

      const meta = (inv?.metadata || {}) as Record<string, string>;
      let newOrgId = row.org_id ?? meta.orgId ?? null;
      if (!newOrgId && adopt) {
        // adopt current org if missing
        newOrgId = currentOrg;
      }

      // Candidate client via metadata
      let newClientId: string | null = row.client_id ?? meta.clientId ?? meta.app_client_id ?? null;

      // If no client yet, try by email
      if (!newClientId && newOrgId) {
        let email =
          inv?.customer_email ||
          (typeof inv?.customer === "string"
            ? null
            : (inv?.customer && "deleted" in inv.customer && !inv.customer.deleted
                ? (inv.customer as Stripe.Customer).email ?? null
                : null)) ||
          null;

        // If invoice has only customer id, fetch for email
        if (!email && inv?.customer && typeof inv.customer === "string") {
          try {
            const cust = await stripe.customers.retrieve(inv.customer);
            email = (cust as Stripe.Customer).email ?? null;
          } catch { /* ignore */ }
        }

        if (email) {
          const { data: found } = await admin
            .from("clients")
            .select("id")
            .eq("org_id", newOrgId)
            .ilike("email", email.toLowerCase())
            .maybeSingle();

          if (found?.id) {
            newClientId = found.id;
            summary.matched_by_email++;
          }
        }
      } else if (newClientId) {
        summary.matched_by_meta++;
      }

      // Nothing to update?
      const patch: Partial<{ org_id: string; client_id: string }> = {};
      if (!row.org_id && newOrgId) patch.org_id = newOrgId;
      if (!row.client_id && newClientId) patch.client_id = newClientId;

      if (Object.keys(patch).length === 0) {
        summary.skipped_no_match++;
        continue;
      }

      const { error: upErr } = await admin
        .from("invoices")
        .update(patch)
        .eq("id", row.id);

      if (!upErr) {
        summary.updated++;
      }
    }

    return NextResponse.json({ ok: true, adopt, limit, summary });
  } catch (e: unknown) {
    const message = typeof e === "object" && e !== null && "message" in e ? (e as { message?: string }).message : undefined;
    return NextResponse.json({ error: message ?? "Relink failed" }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
