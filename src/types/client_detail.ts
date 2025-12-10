export type Client = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: 'Lead' | 'Prospect' | 'Active' | 'Past';
  tags: string[];
  created_at: string;
};

export type ClientOverview = Client & {
  total_invoiced_cents: number;
  total_paid_cents: number;
  balance_due_cents: number;
  current_stage: 'Contacted' | 'Negotiation' | 'Contract Sent' | 'Contract Signed' | 'Won' | 'Lost' | 'Abandoned' | null;
  last_activity_at: string | null;
};

export type Note = {
  id: string;
  org_id: string;
  relates_to: 'client';
  relates_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  org_id: string;
  assignee: string | null;
  relates_to: 'client';
  relates_id: string;
  title: string;
  due_at: string | null;
  done: boolean;
  created_at: string;
};

export type InvoiceLite = {
  id: string;
  status: string;
  amount_cents: number;
  description?: string | null;
  issued_at: string | null;
  due_at: string | null;
  stripe_invoice_id?: string | null;
};
