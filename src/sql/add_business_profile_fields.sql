-- === Business Profile Fields Migration ===

-- General (non-sensitive) fields
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_name      text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_street     text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_city       text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_state      text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_zip        text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone              text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email              text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website            text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_type      text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS formation_date     date;

-- Sensitive fields (stored as AES-256-GCM encrypted strings: "iv:tag:ciphertext" in hex)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ein_encrypted              text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ssn_encrypted              text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_name                  text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_routing_encrypted     text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_account_encrypted     text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS state_tax_id_encrypted     text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_license_encrypted text;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- RLS policies for owner access
DO $$
BEGIN
  -- Drop existing policies if they exist to avoid conflicts
  DROP POLICY IF EXISTS org_owner_read ON organizations;
  DROP POLICY IF EXISTS org_owner_write ON organizations;
END $$;

CREATE POLICY org_owner_read ON organizations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM org_members m
    WHERE m.org_id = organizations.id AND m.user_id = auth.uid()
  ));

CREATE POLICY org_owner_write ON organizations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM org_members m
    WHERE m.org_id = organizations.id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members m
    WHERE m.org_id = organizations.id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  ));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
