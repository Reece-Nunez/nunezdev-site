-- Update deal stages to new custom stages
-- Remove old constraint and add new one with the updated stages
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check 
    CHECK (stage IN ('Contacted','Negotiation','Contract Sent','Contract Signed','Won','Lost','Abandoned'));

-- Update existing deals to map to new stages
-- This preserves your existing data by mapping old stages to closest new equivalents
UPDATE deals SET stage = 'Contacted' WHERE stage IN ('New', 'Discovery', 'Qualified', 'Appointment');
UPDATE deals SET stage = 'Negotiation' WHERE stage IN ('Proposal', 'Contract');
-- Won, Lost remain the same
-- Add any other mappings as needed

-- Clean up any HubSpot-specific stages that might exist
UPDATE deals SET stage = 'Negotiation' WHERE stage = 'Closed' AND stage NOT IN ('Won', 'Lost');