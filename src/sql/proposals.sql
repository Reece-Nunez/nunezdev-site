-- Proposals Table Migration
-- Run this in Supabase SQL Editor

-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Proposal details
  proposal_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Line items (same format as invoices)
  line_items JSONB DEFAULT '[]'::jsonb,

  -- Amounts
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),

  -- Dates
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until DATE,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,

  -- Signing (when accepted)
  require_signature BOOLEAN DEFAULT true,
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  signer_email TEXT,
  signer_ip TEXT,
  signature_svg TEXT,

  -- Project details (for SOW-style proposals)
  project_overview TEXT,
  project_start_date DATE,
  estimated_delivery_date DATE,
  technology_stack TEXT,
  terms_conditions TEXT,

  -- Payment terms
  payment_terms TEXT,
  payment_schedule JSONB,

  -- Conversion tracking
  converted_to_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  -- Public access
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Notes
  internal_notes TEXT,
  rejection_reason TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proposals_org_id ON proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_access_token ON proposals(access_token);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- Enable RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view proposals in their org" ON proposals
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert proposals in their org" ON proposals
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "Users can update proposals in their org" ON proposals
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "Users can delete proposals in their org" ON proposals
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member')
    )
  );

-- Public access policy for clients viewing proposals via token
CREATE POLICY "Public can view proposals via access token" ON proposals
  FOR SELECT USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_updated_at();

-- Function to generate proposal number
CREATE OR REPLACE FUNCTION generate_proposal_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_str TEXT;
  next_num INTEGER;
  proposal_num TEXT;
BEGIN
  year_str := to_char(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN proposal_number ~ ('^PROP-' || year_str || '-[0-9]+$')
      THEN CAST(substring(proposal_number from '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM proposals
  WHERE org_id = p_org_id;

  proposal_num := 'PROP-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN proposal_num;
END;
$$ LANGUAGE plpgsql;

-- View for proposal statistics
CREATE OR REPLACE VIEW proposal_stats AS
SELECT
  org_id,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
  COUNT(*) FILTER (WHERE status = 'viewed') AS viewed_count,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_count,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'accepted'), 0) AS accepted_value_cents,
  COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('sent', 'viewed')), 0) AS pending_value_cents
FROM proposals
GROUP BY org_id;

-- Grant access to the view
GRANT SELECT ON proposal_stats TO authenticated;
