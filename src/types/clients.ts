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
  total_invoiced_cents: number;
  total_paid_cents: number;
  balance_due_cents: number;
  draft_invoiced_cents: number;
  current_stage: 'Contacted' | 'Negotiation' | 'Contract Sent' | 'Contract Signed' | 'Won' | 'Lost' | 'Abandoned' | null;
  last_activity_at: string | null;
};
