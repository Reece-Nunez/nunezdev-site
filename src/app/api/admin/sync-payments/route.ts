import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  
  const supabase = await supabaseServer();

  try {
    // Call the sync function
    const { error } = await supabase.rpc('sync_invoice_payment_totals');
    
    if (error) {
      console.error("Error calling sync function:", error);
      return NextResponse.json({ 
        error: "Failed to sync payment totals",
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Payment totals synchronized successfully" 
    });
    
  } catch (error) {
    console.error("Error syncing payments:", error);
    return NextResponse.json({ 
      error: "Failed to sync payment totals",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}