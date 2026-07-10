export type ClientOverview = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: 'Lead' | 'Prospect' | 'Active' | 'Past';
  tags: string[];
  created_at: string;
  // Legacy single-site integration fields. Superseded by client_sites (one row
  // per site); kept for back-compat and as the Phase-1 backfill source.
  website_url: string | null;
  ga4_property_id: string | null;
  vercel_project_id: string | null;
  gsc_site_url: string | null;
  total_invoiced_cents: number;
  total_paid_cents: number;
  balance_due_cents: number;
  draft_invoiced_cents: number;
  current_stage: 'Contacted' | 'Negotiation' | 'Contract Sent' | 'Contract Signed' | 'Won' | 'Lost' | 'Abandoned' | null;
  last_activity_at: string | null;
};

/**
 * A single website/project belonging to a client. A client can have several.
 * Each carries its own report-automation wiring and is reported on separately.
 */
export type ClientSite = {
  id: string;
  org_id: string;
  client_id: string;
  label: string;
  website_url: string | null;
  ga4_property_id: string | null;
  vercel_project_id: string | null;
  gsc_site_url: string | null;
  github_repo: string | null;
  created_at: string;
  updated_at: string;
};
