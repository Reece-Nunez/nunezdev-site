import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: dealId } = await ctx.params;
    const { amount_cents, description, due_days = 30 } = await req.json();
    const supabase = await supabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = memberships?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    // Get the deal to ensure it exists and get client info
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(`
        id,
        title,
        value_cents,
        client_id,
        client:client_id (
          id,
          name,
          email
        )
      `)
      .eq("id", dealId)
      .eq("org_id", orgId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (!deal.client_id) {
      return NextResponse.json({ error: "Deal must have a client to create an invoice" }, { status: 400 });
    }

    // Calculate due date
    const issuedAt = new Date();
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + due_days);

    // Create the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        client_id: deal.client_id,
        status: "draft",
        amount_cents: amount_cents || deal.value_cents,
        description: description || `Invoice for ${deal.title}`,
        issued_at: issuedAt.toISOString(),
        due_at: dueAt.toISOString(),
        source: "deal",
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      invoice,
      message: "Invoice created successfully"
    });

  } catch (error: unknown) {
    console.error("Failed to create invoice from deal:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}