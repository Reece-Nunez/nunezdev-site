import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await supabaseServer();
  
  // Use known org_id for debugging
  const orgId = "38a6ef02-f4dc-43c8-b5ce-bebbb8ff4728";
  
  try {
    // Simulate the same query as the real /api/clients endpoint
    const { data, error } = await supabase
      .from("clients_overview")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Focus on Matt Williams and Alphonse Bosque
    const mattWilliams = data?.find(c => c.name === "Matt Williams");
    const alphonseBosque = data?.find(c => c.name === "Alphonse Bosque");

    // Calculate what the frontend should show with our fix
    const mattCalculated = mattWilliams ? {
      name: mattWilliams.name,
      database_invoiced: mattWilliams.total_invoiced_cents,
      database_paid: mattWilliams.total_paid_cents,
      database_due: mattWilliams.balance_due_cents,
      frontend_calculated_due: mattWilliams.total_invoiced_cents - mattWilliams.total_paid_cents,
      difference: (mattWilliams.total_invoiced_cents - mattWilliams.total_paid_cents) - mattWilliams.balance_due_cents
    } : null;

    const alphonseCalculated = alphonseBosque ? {
      name: alphonseBosque.name,
      database_invoiced: alphonseBosque.total_invoiced_cents,
      database_paid: alphonseBosque.total_paid_cents,
      database_due: alphonseBosque.balance_due_cents,
      frontend_calculated_due: alphonseBosque.total_invoiced_cents - alphonseBosque.total_paid_cents,
      difference: (alphonseBosque.total_invoiced_cents - alphonseBosque.total_paid_cents) - alphonseBosque.balance_due_cents
    } : null;

    return NextResponse.json({
      total_clients: data?.length || 0,
      raw_data: data || [],
      matt_williams: mattCalculated,
      alphonse_bosque: alphonseCalculated,
      matt_expected_due_usd: mattWilliams ? ((mattWilliams.total_invoiced_cents - mattWilliams.total_paid_cents) / 100).toFixed(2) : null,
      matt_database_due_usd: mattWilliams ? (mattWilliams.balance_due_cents / 100).toFixed(2) : null
    });

  } catch (error) {
    return NextResponse.json({ 
      error: "Database query failed", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}