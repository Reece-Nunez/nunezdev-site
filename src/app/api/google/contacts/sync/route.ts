import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { syncEngine } from "@/lib/google";

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get org
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgId = memberships?.[0]?.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  // Check for full sync parameter
  const { searchParams } = new URL(req.url);
  const fullSync = searchParams.get("full") === "true";

  try {
    const result = await syncEngine.syncContacts({
      orgId,
      fullSync,
      conflictResolution: "newest_wins",
    });

    // Emit real-time event
    await syncEngine.emitSyncEvent(orgId, "contact_synced", {
      created: result.created,
      updated: result.updated,
      conflicts: result.conflicts,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      created: result.created,
      updated: result.updated,
      conflicts: result.conflicts,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("Contact sync failed:", error);
    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgId = memberships?.[0]?.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  // Get sync status
  const status = await syncEngine.getSyncStatus(orgId);

  return NextResponse.json({
    contacts: status.contacts,
    recentLogs: status.recentLogs.filter(l => l.entityType === "contact"),
  });
}
