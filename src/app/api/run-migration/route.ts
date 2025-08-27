import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    console.log('Running deal stages migration...');
    
    // Step 1: Get current deals to see what we're working with
    const { data: currentDeals } = await supabase
      .from('deals')
      .select('id, stage')
      .limit(10);
    
    console.log('Current deals sample:', currentDeals);
    
    // Step 2: Update deals with old stages to new stages
    const updates = [
      {
        description: "Update 'New', 'Discovery', 'Qualified', 'Appointment' to 'Contacted'",
        update: async () => supabase
          .from('deals')
          .update({ stage: 'Contacted' })
          .in('stage', ['New', 'Discovery', 'Qualified', 'Appointment'])
      },
      {
        description: "Update 'Proposal', 'Contract' to 'Negotiation'", 
        update: async () => supabase
          .from('deals')
          .update({ stage: 'Negotiation' })
          .in('stage', ['Proposal', 'Contract'])
      }
    ];
    
    const results = [];
    for (const updateOp of updates) {
      try {
        const { data, error, count } = await updateOp.update();
        results.push({
          description: updateOp.description,
          success: !error,
          updatedCount: count,
          error: error?.message
        });
        console.log(`${updateOp.description}: ${count} rows updated`);
      } catch (e) {
        results.push({
          description: updateOp.description,
          success: false,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }
    
    // Step 3: Get updated deals to confirm and count by stage
    const { data: updatedDeals } = await supabase
      .from('deals')
      .select('stage');
    
    // Create a count summary
    const stageCounts: Record<string, number> = {};
    updatedDeals?.forEach(deal => {
      stageCounts[deal.stage] = (stageCounts[deal.stage] || 0) + 1;
    });
    
    console.log('Updated deals by stage:', stageCounts);
    
    return NextResponse.json({
      success: true,
      message: "Migration completed via application",
      results,
      stageCounts,
      totalDeals: updatedDeals?.length || 0,
      note: "Database constraint still needs to be updated manually when Supabase dashboard is accessible"
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Migration failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}