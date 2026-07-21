import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { AgreementSection } from "@/types/agreements";

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

function sanitizeSections(input: unknown): AgreementSection[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      heading: typeof s?.heading === "string" ? s.heading : "",
      body: typeof s?.body === "string" ? s.body : "",
    }))
    .filter((s) => s.heading.trim() !== "" || s.body.trim() !== "");
}

// GET /api/agreements/[id] - Fetch a single agreement (authed, org-scoped)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { data: agreement, error } = await supabase
    .from("agreements")
    .select(`
      *,
      clients (id, name, email, company, phone, sms_opted_out_at)
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !agreement) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
  }

  return NextResponse.json({ agreement });
}

// PATCH /api/agreements/[id] - Update an agreement (only while editable)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    // Don't allow content edits once a party has signed — the signed document
    // must match what was signed. draft/sent/viewed are still editable.
    const { data: existing, error: fetchError } = await supabase
      .from("agreements")
      .select("status")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }
    if (["signed", "countersigned"].includes(existing.status)) {
      return NextResponse.json(
        { error: "This agreement has been signed and can no longer be edited." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") patch.title = body.title;
    if ("summary" in body) patch.summary = body.summary ?? null;
    if ("sections" in body) patch.sections = sanitizeSections(body.sections);
    if ("valid_until" in body) patch.valid_until = body.valid_until || null;
    if (typeof body.require_signature === "boolean") patch.require_signature = body.require_signature;
    if ("internal_notes" in body) patch.internal_notes = body.internal_notes ?? null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    const { data: agreement, error: updateError } = await supabase
      .from("agreements")
      .update(patch)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating agreement:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ agreement });
  } catch (error) {
    console.error("Error in PATCH /api/agreements/[id]:", error);
    return NextResponse.json({ error: "Failed to update agreement" }, { status: 500 });
  }
}

// DELETE /api/agreements/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { error } = await supabase
    .from("agreements")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("Error deleting agreement:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
