import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { 
      invoice_id, 
      client_id, 
      activity_type, 
      activity_data = {},
      user_agent,
      ip_address 
    } = await req.json();

    // Validate required fields
    if (!invoice_id || !client_id || !activity_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Insert activity log
    const { data, error } = await supabase
      .from('client_activity_log')
      .insert({
        invoice_id,
        client_id,
        activity_type,
        activity_data,
        user_agent,
        ip_address
      })
      .select()
      .single();

    if (error) {
      console.error("Error tracking client activity:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      activity_id: data.id,
      message: `Activity ${activity_type} tracked successfully` 
    });
  } catch (error) {
    console.error("Error in activity tracking:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// Get activity log for an invoice (for business owner)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const invoice_id = url.searchParams.get('invoice_id');
    const client_id = url.searchParams.get('client_id');

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    let query = supabase
      .from('client_activity_log')
      .select(`
        id,
        activity_type,
        activity_data,
        created_at,
        user_agent,
        ip_address
      `)
      .eq('invoice_id', invoice_id)
      .order('created_at', { ascending: false });

    if (client_id) {
      query = query.eq('client_id', client_id);
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error("Error fetching activity log:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ activities: activities || [] });
  } catch (error) {
    console.error("Error in activity fetching:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}