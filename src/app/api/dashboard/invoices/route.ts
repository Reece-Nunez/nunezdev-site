import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  const url = new URL(req.url);
  const status = url.searchParams.get('status'); // sent|paid|overdue|draft|void|all
  const from = url.searchParams.get('from');     // ISO date
  const to = url.searchParams.get('to');         // ISO date
  const q = url.searchParams.get('q');           // client name/email contains
  const limit = Number(url.searchParams.get('limit') ?? 50);

  // Base query - include payment data for accurate calculations
  let query = supabase.from("invoices")
    .select(`
      id, client_id, invoice_number, title, status, amount_cents, issued_at, due_at, stripe_invoice_id, signed_at, hosted_invoice_url,
      clients(id,name,email),
      invoice_payments(amount_cents, payment_method, paid_at)
    `)
    .eq("org_id", orgId)
    .order("issued_at", { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    if (status === 'overdue') {
      // Overdue = past due date AND not fully paid (not 'paid' or 'void')
      query = query
        .lt("due_at", new Date().toISOString())
        .not("status", "in", "(paid,void)");
    } else {
      query = query.eq("status", status);
    }
  }
  if (from) query = query.gte("issued_at", from);
  if (to) query = query.lte("issued_at", to);
  // Basic client name/email filtering via nested select alias
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const filtered = q ? (data ?? []).filter(r => {
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    const name = (client?.name ?? '').toLowerCase();
    const email = (client?.email ?? '').toLowerCase();
    return name.includes(q.toLowerCase()) || email.includes(q.toLowerCase());
  }) : (data ?? []);

  return NextResponse.json({ invoices: filtered });
}
