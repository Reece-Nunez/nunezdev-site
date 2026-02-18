import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// GET /api/notifications - list recent notifications + unread count
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const supabase = await supabaseServer();

  try {
    // Fetch latest 30 notifications
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read, metadata, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("[notifications] Error fetching:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Count unread
    const { count, error: countError } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("read", false);

    if (countError) {
      console.error("[notifications] Error counting unread:", countError);
    }

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: count || 0,
    });
  } catch (error) {
    console.error("[notifications] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/notifications - mark as read
// Body: { id: "uuid" } for single, { all: true } for all
export async function PATCH(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const supabase = await supabaseServer();
  const body = await req.json();

  try {
    if (body.all === true) {
      // Mark all as read
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("org_id", orgId)
        .eq("read", false);

      if (error) {
        return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    } else if (body.id) {
      // Mark single as read
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", body.id)
        .eq("org_id", orgId);

      if (error) {
        return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Provide 'id' or 'all: true'" }, { status: 400 });
    }
  } catch (error) {
    console.error("[notifications] Error updating:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
