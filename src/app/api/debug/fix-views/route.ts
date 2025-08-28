import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import fs from 'fs';
import path from 'path';

export async function POST() {
  const supabase = await supabaseServer();
  
  try {
    // Read the SQL file that recreates the views
    const sqlPath = path.join(process.cwd(), 'src/sql/recreate_clients_overview.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL to recreate the views
    const { error } = await supabase.rpc('exec_sql', { sql_text: sql });

    if (error) {
      // Try executing it as raw SQL if rpc doesn't work
      const { error: rawError } = await supabase.from('__temp').select('*').limit(0);
      // Since we can't execute raw SQL directly, let's execute each statement separately
      
      const statements = sql.split(';').filter(stmt => stmt.trim());
      const results = [];
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            // This won't work directly but let's log what we need to do
            results.push({ statement: statement.trim(), status: 'pending' });
          } catch (e) {
            results.push({ statement: statement.trim(), status: 'error', error: e instanceof Error ? e.message : String(e) });
          }
        }
      }

      return NextResponse.json({ 
        message: "Cannot execute SQL directly via Supabase client. Manual execution required.",
        error: error?.message,
        sql_statements: results,
        instructions: "These SQL statements need to be run manually in the database console."
      });
    }

    // Check if the views were recreated successfully
    const { data: viewData, error: viewError } = await supabase
      .from("clients_overview")
      .select("id, name, total_invoiced_cents, total_paid_cents, balance_due_cents")
      .limit(5);

    return NextResponse.json({ 
      success: true, 
      message: "Views recreated successfully",
      sample_data: viewData,
      view_error: viewError?.message
    });

  } catch (error) {
    return NextResponse.json({ 
      error: "Failed to recreate views", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}