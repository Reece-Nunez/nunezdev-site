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

// GET /api/time-entries - List time entries with filters
export async function GET(request: NextRequest) {
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const status = searchParams.get('status');
  const billable = searchParams.get('billable');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const limit = parseInt(searchParams.get('limit') || '100');

  let query = supabase
    .from("time_entries")
    .select(`
      *,
      clients (id, name, company)
    `)
    .eq("org_id", orgId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clientId) query = query.eq("client_id", clientId);
  if (status) query = query.eq("status", status);
  if (billable === 'true') query = query.eq("billable", true);
  if (billable === 'false') query = query.eq("billable", false);
  if (startDate) query = query.gte("entry_date", startDate);
  if (endDate) query = query.lte("entry_date", endDate);

  const { data: entries, error } = await query;

  if (error) {
    console.error("Error fetching time entries:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: entries ?? [] });
}

// POST /api/time-entries - Create new time entry (manual or start timer)
export async function POST(request: NextRequest) {
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    const body = await request.json();
    const {
      client_id,
      description,
      duration_minutes,
      entry_date,
      billable = true,
      hourly_rate_cents,
      project,
      tags,
      start_timer = false
    } = body;

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    // If starting a timer, check for existing running timer
    if (start_timer) {
      const { data: running } = await supabase
        .from("time_entries")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "running")
        .limit(1);

      if (running && running.length > 0) {
        return NextResponse.json({ error: "A timer is already running. Stop it first." }, { status: 400 });
      }
    }

    const entryData: Record<string, unknown> = {
      org_id: orgId,
      client_id: client_id || null,
      description,
      billable,
      hourly_rate_cents: hourly_rate_cents || null,
      project: project || null,
      tags: tags || null,
      entry_date: entry_date || new Date().toISOString().split('T')[0]
    };

    if (start_timer) {
      entryData.status = 'running';
      entryData.started_at = new Date().toISOString();
      entryData.duration_minutes = 0;
    } else {
      entryData.status = 'logged';
      entryData.duration_minutes = duration_minutes || 0;
    }

    const { data: entry, error: insertError } = await supabase
      .from("time_entries")
      .insert(entryData)
      .select(`
        *,
        clients (id, name, company)
      `)
      .single();

    if (insertError) {
      console.error("Error creating time entry:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/time-entries:", error);
    return NextResponse.json({ error: "Failed to create time entry" }, { status: 500 });
  }
}
