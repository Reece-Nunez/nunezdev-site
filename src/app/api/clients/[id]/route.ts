import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };


export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // ✅ await params
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  // Pull from the overview view so we get financials and stage
  const { data, error } = await supabase
    .from("clients_overview")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  return NextResponse.json({ client: data });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  // Allow partial updates; none of the fields are required
  const allowed = ["name", "email", "phone", "company", "status", "tags"];
  type Patch = {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    status?: string;
    tags?: string[];
  };
  const patch: Patch = {};
  for (const k of allowed) if (k in body) patch[k as keyof Patch] = body[k];

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ client: data });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    // Verify client belongs to org
    const { data: client } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Delete all related data in the correct order (respecting foreign key constraints)
    
    // 1. Get all invoice IDs for this client first
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .eq("client_id", id)
      .eq("org_id", orgId);

    // 2. Delete invoice payments first (if there are invoices)
    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map(inv => inv.id);
      await supabase
        .from("invoice_payments")
        .delete()
        .in("invoice_id", invoiceIds);
    }

    // 3. Delete invoices
    await supabase
      .from("invoices")
      .delete()
      .eq("client_id", id)
      .eq("org_id", orgId);

    // 4. Delete notes
    await supabase
      .from("notes")
      .delete()
      .eq("relates_to", "client")
      .eq("relates_id", id)
      .eq("org_id", orgId);

    // 5. Delete tasks
    await supabase
      .from("tasks")
      .delete()
      .eq("relates_to", "client")
      .eq("relates_id", id)
      .eq("org_id", orgId);

    // 6. Finally delete the client
    const { error: deleteError } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (deleteError) {
      console.error("Error deleting client:", deleteError);
      return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Client "${client.name}" and all related data has been deleted` 
    });

  } catch (error) {
    console.error("Error in client deletion:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
