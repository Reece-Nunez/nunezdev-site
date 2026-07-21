/**
 * Types for the reusable Agreements feature — brand-styled partnership/contract
 * documents with bilateral signing (client signs via token, operator
 * counter-signs from the dashboard). See src/sql/agreements.sql.
 */

export type AgreementStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'countersigned'
  | 'declined'
  | 'expired';

/** One narrative block of the agreement body. `body` may contain newlines and
 *  simple "• " / "- " bullet lines, rendered by the public/detail pages. */
export interface AgreementSection {
  heading: string;
  body: string;
}

export interface AgreementClient {
  id: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null;
  sms_opted_out_at?: string | null;
}

export interface Agreement {
  id: string;
  org_id: string;
  client_id: string;
  agreement_number: string;
  title: string;
  summary?: string | null;
  sections: AgreementSection[];
  status: AgreementStatus;
  require_signature: boolean;

  created_at: string;
  updated_at: string;
  valid_until?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  declined_at?: string | null;

  // Owner (client) signature
  client_signed_at?: string | null;
  client_signer_name?: string | null;
  client_signer_email?: string | null;
  client_signer_ip?: string | null;
  client_signature_svg?: string | null;

  // Developer (Reece) counter-signature
  dev_signed_at?: string | null;
  dev_signer_name?: string | null;
  dev_signature_svg?: string | null;

  fully_executed_at?: string | null;

  access_token: string;
  internal_notes?: string | null;
  decline_reason?: string | null;

  clients?: AgreementClient | null;
}
