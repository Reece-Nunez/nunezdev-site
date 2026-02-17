import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// GET /api/recurring-expenses/[id] - Get a single recurring expense
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { id } = await context.params;
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(`
      *,
      clients(id, name, company)
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH /api/recurring-expenses/[id] - Update a recurring expense
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { id } = await context.params;
  const body = await req.json();

  const allowedFields = [
    "description",
    "amount_cents",
    "frequency",
    "day_of_month",
    "start_date",
    "end_date",
    "category",
    "client_id",
    "is_billable",
    "is_tax_deductible",
    "tax_category",
    "payment_method",
    "vendor",
    "notes",
    "is_active",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("recurring_expenses")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    console.error("Error updating recurring expense:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/recurring-expenses/[id] - Delete a recurring expense
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { id } = await context.params;
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("recurring_expenses")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("Error deleting recurring expense:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
