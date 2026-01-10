import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { contactsService } from "@/lib/google";

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
    .select("*, google_contact_id, google_contact_etag")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Sync update to Google Contacts (async, don't block response)
  if (contactsService.isAvailable() && data.google_contact_id) {
    contactsService
      .updateContact(
        data.google_contact_id,
        {
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
        },
        data.google_contact_etag
      )
      .then(async (result) => {
        if (result.success && result.etag) {
          const adminSupabase = await supabaseServer();
          await adminSupabase
            .from("clients")
            .update({
              google_contact_etag: result.etag,
              google_last_synced_at: new Date().toISOString(),
            })
            .eq("id", id);
          console.log(`Synced client update ${data.name} to Google Contacts`);
        }
      })
      .catch((err) => {
        console.error("Failed to sync client update to Google:", err.message);
      });
  }

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
    // Verify client belongs to org and get Google Contact ID
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, google_contact_id")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Delete from Google Contacts first (if linked)
    if (contactsService.isAvailable() && client.google_contact_id) {
      try {
        await contactsService.deleteContact(client.google_contact_id);
        console.log(`Deleted Google Contact for client: ${client.name}`);
      } catch (err: any) {
        console.error("Failed to delete Google Contact:", err.message);
        // Continue with local delete even if Google delete fails
      }
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
