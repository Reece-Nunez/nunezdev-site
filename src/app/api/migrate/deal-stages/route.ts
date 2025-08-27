import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Since we can't directly execute SQL through Supabase client for schema changes,
    // we'll provide manual instructions
    const migrationSteps = [
      "1. Remove old constraint: ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;",
      "2. Add new constraint: ALTER TABLE deals ADD CONSTRAINT deals_stage_check CHECK (stage IN ('Contacted','Negotiation','Contract Sent','Contract Signed','Won','Lost','Abandoned'));",
      "3. Update existing deals: UPDATE deals SET stage = 'Contacted' WHERE stage IN ('New', 'Discovery', 'Qualified', 'Appointment');",
      "4. Update proposal deals: UPDATE deals SET stage = 'Negotiation' WHERE stage IN ('Proposal', 'Contract');",
      "5. Clean up other stages: UPDATE deals SET stage = 'Negotiation' WHERE stage = 'Closed' AND stage NOT IN ('Won', 'Lost');"
    ];

    return NextResponse.json({ 
      success: false,
      message: "Database migration needs to be run manually",
      steps: migrationSteps,
      note: "Run these SQL commands in your database console or via Supabase dashboard"
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}