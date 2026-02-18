import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// One-time cleanup: delete old manual bulk Thumbtack entries
// that are now replaced by individual per-lead imports
export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  // Find old manual Thumbtack entries (vendor=Thumbtack but NOT category=lead_fees)
  const { data: duplicates, error: fetchError } = await supabase
    .from("expenses")
    .select("id, description, amount_cents, expense_date, category")
    .eq("org_id", orgId)
    .eq("vendor", "Thumbtack")
    .neq("category", "lead_fees");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!duplicates || duplicates.length === 0) {
    return NextResponse.json({ message: "No duplicate Thumbtack entries found", deleted: 0 });
  }

  // Delete them
  const ids = duplicates.map(d => d.id);
  const { error: deleteError } = await supabase
    .from("expenses")
    .delete()
    .in("id", ids);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Deleted ${duplicates.length} old manual Thumbtack entries`,
    deleted: duplicates.length,
    entries: duplicates.map(d => ({
      description: d.description,
      amount: `$${(d.amount_cents / 100).toFixed(2)}`,
      date: d.expense_date,
      category: d.category,
    })),
  });
}
