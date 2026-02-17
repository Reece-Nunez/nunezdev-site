import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// GET /api/recurring-expenses - List all recurring expenses
export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(`
      *,
      clients(id, name, company)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching recurring expenses:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/recurring-expenses - Create a new recurring expense
export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const body = await req.json();
  const {
    description,
    amount_cents,
    frequency,
    day_of_month,
    start_date,
    end_date,
    category,
    client_id,
    is_billable,
    is_tax_deductible,
    tax_category,
    payment_method,
    vendor,
    notes,
  } = body;

  if (!description || !amount_cents) {
    return NextResponse.json(
      { error: "Description and amount are required" },
      { status: 400 }
    );
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({
      org_id: orgId,
      description,
      amount_cents,
      frequency: frequency || "monthly",
      day_of_month: day_of_month || 1,
      start_date: start_date || new Date().toISOString().split("T")[0],
      end_date: end_date || null,
      category: category || "other",
      client_id: client_id || null,
      is_billable: is_billable || false,
      is_tax_deductible: is_tax_deductible !== false,
      tax_category: tax_category || null,
      payment_method: payment_method || null,
      vendor: vendor || null,
      notes: notes || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating recurring expense:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
