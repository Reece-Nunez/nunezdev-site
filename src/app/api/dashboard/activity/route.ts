import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// Returns a merged, recent list of activity items
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  const [notes, invoices, tasks] = await Promise.all([
    supabase.from("notes").select("id, created_at, body, relates_to, relates_id").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20),
    supabase.from("invoices").select("id, issued_at, status, amount_cents, client_id").eq("org_id", orgId).order("issued_at", { ascending: false }).limit(20),
    supabase.from("tasks").select("id, created_at, title, done, relates_to, relates_id").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20),
  ]);

  type Note = { id: string; created_at: string; body: string; relates_to: string; relates_id: string };
  type Invoice = { id: string; issued_at: string; status: string; amount_cents: number; client_id: string };
  type Task = { id: string; created_at: string; title: string; done: boolean; relates_to: string; relates_id: string };

  type ActivityItem =
    | { type: 'note'; ts: string; data: Note }
    | { type: 'invoice'; ts: string; data: Invoice }
    | { type: 'task'; ts: string; data: Task };

  const items: ActivityItem[] = [];
  (notes.data ?? []).forEach(n => items.push({ type: 'note', ts: n.created_at, data: n }));
  (invoices.data ?? []).forEach(i => items.push({ type: 'invoice', ts: i.issued_at, data: i }));
  (tasks.data ?? []).forEach(t => items.push({ type: 'task', ts: t.created_at, data: t }));

  items.sort((a, b) => new Date(b.ts as string).getTime() - new Date(a.ts as string).getTime());

  return NextResponse.json({ items: items.slice(0, 30) });
}
