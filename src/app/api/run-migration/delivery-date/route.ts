import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const supabase = await supabaseServer();
    
    // Add delivery_date column to invoices table
    const { error } = await supabase
      .rpc('exec_sql', { 
        sql_query: 'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_date date;' 
      });
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      message: "delivery_date column added successfully to invoices table",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ 
      error: "Migration failed", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}