import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import { promises as fs } from 'fs';
import path from 'path';

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const supabase = await supabaseServer();
    
    // Read the SQL migration file
    const sqlPath = path.join(process.cwd(), 'src', 'sql', 'add_enhanced_invoice_fields.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      message: "Enhanced invoice fields migration completed successfully",
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