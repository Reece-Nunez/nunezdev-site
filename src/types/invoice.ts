export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void' | 'overdue' | 'partially_paid';

export type PaymentTerms = '7' | '14' | '30' | '45' | '60' | '90' | 'due_on_receipt' | 'net_30' | 'custom';

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
  tax_rate?: number;
  category?: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  line_items: InvoiceLineItem[];
  payment_terms: PaymentTerms;
  notes?: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  client_id: string;
  stripe_invoice_id?: string;
  status: InvoiceStatus;
  
  // Basic info
  invoice_number?: string;
  title?: string;
  description?: string;
  notes?: string;
  
  // Amounts
  amount_cents: number;
  subtotal_cents?: number;
  tax_cents?: number;
  discount_cents?: number;
  
  // Line items
  line_items?: InvoiceLineItem[];
  
  // Dates
  issued_at?: string;
  due_at?: string;
  paid_at?: string;
  created_at: string;
  
  // Payment
  payment_terms?: PaymentTerms;
  payment_schedule?: any;
  payment_method?: string;
  
  // Branding & customization
  brand_logo_url?: string;
  brand_primary?: string;
  currency_code?: string;
  
  // Signature
  require_signature?: boolean;
  signed_at?: string;
  signer_name?: string;
  signer_email?: string;
  hosted_invoice_url?: string;
  
  // Relationships
  clients?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  
  invoice_payments?: Array<{
    id: string;
    amount_cents: number;
    payment_method: string;
    paid_at: string;
  }>;
  
  // Stripe integration
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
}

export interface CreateInvoiceData {
  client_id: string;
  title?: string;
  description?: string;
  notes?: string;
  line_items: InvoiceLineItem[];
  payment_terms: PaymentTerms;
  due_days?: number;
  require_signature?: boolean;
  brand_logo_url?: string;
  brand_primary?: string;
  send_immediately?: boolean;
}

export interface InvoiceFilters {
  status?: InvoiceStatus | 'all';
  client_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  payment_overdue?: boolean;
}