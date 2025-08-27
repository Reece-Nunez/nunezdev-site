import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const supabase = await supabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = memberships?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    // Fetch deal with all related information
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(`
        id,
        title,
        stage,
        value_cents,
        probability,
        expected_close_date,
        description,
        created_at,
        updated_at,
        source,
        hubspot_deal_id,
        client:client_id (
          id,
          name,
          email,
          phone,
          company,
          status
        )
      `)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (dealError) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Fetch invoices related to this deal's client
    const { data: invoices } = await supabase
      .from("invoices")
      .select(`
        id,
        status,
        amount_cents,
        issued_at,
        due_at,
        description,
        created_at,
        invoice_payments (
          id,
          amount_cents,
          paid_at,
          payment_method,
          stripe_payment_intent_id,
          notes
        )
      `)
      .eq("client_id", deal.client?.id)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    // Calculate payment totals
    let totalInvoiced = 0;
    let totalPaid = 0;
    
    invoices?.forEach(invoice => {
      if (invoice.status !== 'draft') {
        totalInvoiced += invoice.amount_cents || 0;
      }
      invoice.invoice_payments?.forEach(payment => {
        totalPaid += payment.amount_cents || 0;
      });
    });

    const balanceDue = totalInvoiced - totalPaid;

    // Fetch notes related to this deal
    const { data: notes } = await supabase
      .from("notes")
      .select("id, body, created_at, created_by")
      .eq("relates_to", "deal")
      .eq("relates_id", id)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    // Fetch tasks related to this deal
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, done, due_at, created_at")
      .eq("relates_to", "deal")
      .eq("relates_id", id)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      deal,
      invoices: invoices || [],
      notes: notes || [],
      tasks: tasks || [],
      financials: {
        totalInvoiced,
        totalPaid,
        balanceDue
      }
    });

  } catch (error: unknown) {
    console.error("Failed to fetch deal:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const updates = await req.json();
    const supabase = await supabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = memberships?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    // Update the deal
    const { data, error } = await supabase
      .from("deals")
      .update({
        title: updates.title,
        stage: updates.stage,
        value_cents: updates.value_cents,
        probability: updates.probability,
        expected_close_date: updates.expected_close_date,
        description: updates.description,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ deal: data });
  } catch (error: unknown) {
    console.error("Failed to update deal:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const supabase = await supabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = memberships?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    const { error } = await supabase
      .from("deals")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to delete deal:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}