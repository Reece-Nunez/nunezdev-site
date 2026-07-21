-- Agreements Table Migration
-- Reusable, brand-styled partnership/contract documents with BILATERAL signing:
-- the client (Owner) signs via a public token link, and the operator (Developer)
-- counter-signs from the dashboard. An agreement is "fully executed" only when
-- both signatures are present.
--
-- Modeled on proposals.sql, but the body is a narrative `sections` JSONB array
-- ([{ heading, body }]) instead of billable line items — so the same feature can
-- render any contract, not just this one.
--
-- Run in the Supabase SQL Editor, or apply via the Supabase MCP.

CREATE TABLE IF NOT EXISTS agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Document identity
  agreement_number TEXT NOT NULL,
  title TEXT NOT NULL,
  -- Short intro/standfirst rendered under the title (e.g. "A partnership to
  -- build, launch, and maintain ...").
  summary TEXT,

  -- The reusable body: an ordered list of { heading, body } blocks. `body`
  -- supports newlines and simple "• " / "- " bullet lines (rendered client-side).
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status workflow. `signed` = client signed; `countersigned` = both parties
  -- signed (fully executed). Reece may counter-sign before or after the client.
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'countersigned', 'declined', 'expired')),

  require_signature BOOLEAN NOT NULL DEFAULT true,

  -- Dates
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until DATE,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  -- Owner (client) signature — captured on the public token page
  client_signed_at TIMESTAMPTZ,
  client_signer_name TEXT,
  client_signer_email TEXT,
  client_signer_ip TEXT,
  client_signature_svg TEXT,

  -- Developer (Reece) counter-signature — captured from the dashboard
  dev_signed_at TIMESTAMPTZ,
  dev_signer_name TEXT,
  dev_signature_svg TEXT,

  -- Set when BOTH signatures are present.
  fully_executed_at TIMESTAMPTZ,

  -- Public, no-login access
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Notes
  internal_notes TEXT,
  decline_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_agreements_org_id ON agreements(org_id);
CREATE INDEX IF NOT EXISTS idx_agreements_client_id ON agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON agreements(status);
CREATE INDEX IF NOT EXISTS idx_agreements_access_token ON agreements(access_token);
CREATE INDEX IF NOT EXISTS idx_agreements_created_at ON agreements(created_at DESC);

-- RLS mirrors proposals: org members read/write their org's rows; a permissive
-- SELECT lets the public token page read a single agreement (writes on that page
-- go through the service role, gated by the secret access_token).
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agreements in their org" ON agreements
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert agreements in their org" ON agreements
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "Users can update agreements in their org" ON agreements
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "Users can delete agreements in their org" ON agreements
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "Public can view agreements via access token" ON agreements
  FOR SELECT USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agreements_updated_at ON agreements;
CREATE TRIGGER agreements_updated_at
  BEFORE UPDATE ON agreements
  FOR EACH ROW
  EXECUTE FUNCTION update_agreements_updated_at();

-- AGR-YYYY-NNNN, per org, mirroring generate_proposal_number.
CREATE OR REPLACE FUNCTION generate_agreement_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_str TEXT;
  next_num INTEGER;
  agreement_num TEXT;
BEGIN
  year_str := to_char(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN agreement_number ~ ('^AGR-' || year_str || '-[0-9]+$')
      THEN CAST(substring(agreement_number from '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM agreements
  WHERE org_id = p_org_id;

  agreement_num := 'AGR-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN agreement_num;
END;
$$ LANGUAGE plpgsql;
