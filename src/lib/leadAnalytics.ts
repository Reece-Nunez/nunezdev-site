import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Lead-source ROI attribution. Joins:
//   leads.lead_source  →  leads.client_id  →  invoices.client_id  →  invoice_payments.amount_cents
// so each marketing source gets credit for revenue from the clients it produced.
//
// Sources are bucketed by `lead_source` (the specific form, e.g. "web_design_ponca_city")
// when set, falling back to `source` (the broader category, e.g. "contact_form") so legacy
// leads predating the lead_source column still appear.

export interface LeadSourceStat {
  source: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number; // 0..1
  totalRevenueCents: number;
  avgRevenuePerClientCents: number;
}

const SOURCE_LABELS: Record<string, string> = {
  contact_page: "Contact page form",
  contact_form: "Contact form (legacy)",
  homepage_hero: "Homepage hero",
  free_website_audit: "Free audit magnet",
  web_design_ponca_city: "Ponca City landing",
  appointment: "Calendar booking",
  manual: "Manually added",
};

export function labelForSource(source: string): string {
  return SOURCE_LABELS[source] || source;
}

export async function getLeadSourceROI(orgId: string): Promise<LeadSourceStat[]> {
  const supabase = supabaseAdmin();

  // Pull every lead with the fields we need to bucket + link. Cap at 2000 to
  // keep this cheap; if the table outgrows that we'll move to a SQL view.
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, lead_source, source, status, client_id")
    .limit(2000);
  if (leadsErr || !leads) return [];

  // Collect every client_id that any lead converted into so we can fetch
  // their lifetime revenue in a single round trip.
  const clientIds = Array.from(
    new Set(
      leads
        .map((l) => l.client_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const revenueByClient = new Map<string, number>();
  if (clientIds.length > 0) {
    const { data: payments } = await supabase
      .from("invoice_payments")
      .select(`
        amount_cents,
        invoices!inner(client_id, org_id)
      `)
      .eq("invoices.org_id", orgId)
      .in("invoices.client_id", clientIds);

    for (const p of payments || []) {
      const cid = (p.invoices as unknown as { client_id: string }).client_id;
      if (!cid) continue;
      revenueByClient.set(cid, (revenueByClient.get(cid) || 0) + (p.amount_cents || 0));
    }
  }

  // Bucket leads by their effective source and aggregate.
  type Bucket = {
    totalLeads: number;
    convertedLeads: number;
    convertedClientIds: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const lead of leads) {
    const source = lead.lead_source || lead.source || "unknown";
    let bucket = buckets.get(source);
    if (!bucket) {
      bucket = { totalLeads: 0, convertedLeads: 0, convertedClientIds: new Set() };
      buckets.set(source, bucket);
    }
    bucket.totalLeads += 1;
    if (lead.status === "converted" || lead.client_id) {
      bucket.convertedLeads += 1;
      if (lead.client_id) bucket.convertedClientIds.add(lead.client_id);
    }
  }

  const stats: LeadSourceStat[] = [];
  for (const [source, bucket] of buckets) {
    let revenue = 0;
    for (const cid of bucket.convertedClientIds) {
      revenue += revenueByClient.get(cid) || 0;
    }
    stats.push({
      source,
      totalLeads: bucket.totalLeads,
      convertedLeads: bucket.convertedLeads,
      conversionRate: bucket.totalLeads > 0 ? bucket.convertedLeads / bucket.totalLeads : 0,
      totalRevenueCents: revenue,
      avgRevenuePerClientCents:
        bucket.convertedClientIds.size > 0
          ? Math.round(revenue / bucket.convertedClientIds.size)
          : 0,
    });
  }

  // Sort: highest revenue first, then highest conversion, then most leads.
  stats.sort((a, b) => {
    if (b.totalRevenueCents !== a.totalRevenueCents)
      return b.totalRevenueCents - a.totalRevenueCents;
    if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
    return b.totalLeads - a.totalLeads;
  });

  return stats;
}
