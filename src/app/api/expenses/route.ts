import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// GET /api/expenses - List all expenses with optional filters
export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const clientId = searchParams.get("client_id");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const isBillable = searchParams.get("is_billable");
  const isTaxDeductible = searchParams.get("is_tax_deductible");

  const supabase = await supabaseServer();

  let query = supabase
    .from("expenses")
    .select(`
      *,
      clients(id, name, company)
    `)
    .eq("org_id", orgId)
    .order("expense_date", { ascending: false });

  if (category) query = query.eq("category", category);
  if (clientId) query = query.eq("client_id", clientId);
  if (startDate) query = query.gte("expense_date", startDate);
  if (endDate) query = query.lte("expense_date", endDate);
  if (isBillable === "true") query = query.eq("is_billable", true);
  if (isBillable === "false") query = query.eq("is_billable", false);
  if (isTaxDeductible === "true") query = query.eq("is_tax_deductible", true);
  if (isTaxDeductible === "false") query = query.eq("is_tax_deductible", false);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/expenses - Create a new expense
export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const body = await req.json();
  const {
    description,
    amount_cents,
    expense_date,
    category,
    client_id,
    is_billable,
    is_tax_deductible,
    tax_category,
    payment_method,
    vendor,
    receipt_url,
    receipt_filename,
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
    .from("expenses")
    .insert({
      org_id: orgId,
      description,
      amount_cents,
      expense_date: expense_date || new Date().toISOString().split("T")[0],
      category: category || "other",
      client_id: client_id || null,
      is_billable: is_billable || false,
      is_tax_deductible: is_tax_deductible !== false, // default true
      tax_category: tax_category || null,
      payment_method: payment_method || null,
      vendor: vendor || null,
      receipt_url: receipt_url || null,
      receipt_filename: receipt_filename || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
