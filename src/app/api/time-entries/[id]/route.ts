import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuthedOrgId() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" } };

  const { data: m, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (error) return { ok: false as const, status: 400 as const, json: { error: error.message } };
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" } };

  return { ok: true as const, supabase, orgId, user };
}

// GET /api/time-entries/[id] - Get single time entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { data: entry, error } = await supabase
    .from("time_entries")
    .select(`
      *,
      clients (id, name, company)
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

// PATCH /api/time-entries/[id] - Update time entry or stop timer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    const body = await request.json();

    // Verify entry belongs to org
    const { data: existing, error: fetchError } = await supabase
      .from("time_entries")
      .select("id, status, started_at")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    // Don't allow editing billed entries
    if (existing.status === 'billed' && body.status !== 'billed') {
      return NextResponse.json({ error: "Cannot edit a billed time entry" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    // Handle stopping a running timer
    if (body.stop_timer && existing.status === 'running') {
      const startedAt = new Date(existing.started_at);
      const now = new Date();
      const durationMs = now.getTime() - startedAt.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      updateData.status = 'logged';
      updateData.ended_at = now.toISOString();
      updateData.duration_minutes = durationMinutes;
    } else {
      // Normal update
      if (body.description !== undefined) updateData.description = body.description;
      if (body.client_id !== undefined) updateData.client_id = body.client_id || null;
      if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes;
      if (body.entry_date !== undefined) updateData.entry_date = body.entry_date;
      if (body.billable !== undefined) updateData.billable = body.billable;
      if (body.hourly_rate_cents !== undefined) updateData.hourly_rate_cents = body.hourly_rate_cents;
      if (body.project !== undefined) updateData.project = body.project || null;
      if (body.tags !== undefined) updateData.tags = body.tags;
      if (body.status !== undefined) updateData.status = body.status;
    }

    const { data: entry, error: updateError } = await supabase
      .from("time_entries")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", orgId)
      .select(`
        *,
        clients (id, name, company)
      `)
      .single();

    if (updateError) {
      console.error("Error updating time entry:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Error in PATCH /api/time-entries/[id]:", error);
    return NextResponse.json({ error: "Failed to update time entry" }, { status: 500 });
  }
}

// DELETE /api/time-entries/[id] - Delete time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  // Check if billed
  const { data: existing } = await supabase
    .from("time_entries")
    .select("status")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (existing?.status === 'billed') {
    return NextResponse.json({ error: "Cannot delete a billed time entry" }, { status: 400 });
  }

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("Error deleting time entry:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
