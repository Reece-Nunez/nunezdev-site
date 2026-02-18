import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// Thumbtack lead fee data extracted from payment history + lead details
const THUMBTACK_LEADS = [
  { name: "Owusu Fordjour Aidoo", date: "2026-02-17", amount_cents: 21335, type: "Web Design" },
  { name: "Elizabeth Murphy Scott", date: "2026-02-06", amount_cents: 21335, type: "Web Design" },
  { name: "Anna Leicht", date: "2026-02-05", amount_cents: 21335, type: "Web Design" },
  { name: "Kyle Flandrau", date: "2026-01-31", amount_cents: 21335, type: "Web Design" },
  { name: "Carlos Perez", date: "2025-09-26", amount_cents: 10668, type: "Web Design" },
  { name: "Kate Courtney", date: "2025-09-25", amount_cents: 17954, type: "Web Design" },
  { name: "King Lewis", date: "2025-09-23", amount_cents: 15415, type: "Software Development" },
  { name: "Lena Eitle", date: "2025-09-22", amount_cents: 7486, type: "Software Development" },
  { name: "Donita Boles", date: "2025-09-22", amount_cents: 5608, type: "Web Design" },
  { name: "donta Burris", date: "2025-09-22", amount_cents: 5608, type: "Web Design" },
  { name: "Treycy Louis", date: "2025-09-20", amount_cents: 2741, type: "Web Design" },
  { name: "Amir Shaw", date: "2025-09-18", amount_cents: 2807, type: "Web Design" },
  { name: "Candi Coleman", date: "2025-09-18", amount_cents: 7929, type: "Web Design", note: "Refund denied" },
  { name: "Nataliya Graur", date: "2025-09-18", amount_cents: 7929, type: "Web Design", note: "Credited/refunded $79.29" },
  { name: "Andree Toebben", date: "2025-09-17", amount_cents: 21335, type: "Web Design" },
  { name: "Christopher Bell", date: "2025-09-16", amount_cents: 10429, type: "Web Design" },
  { name: "Kemonte Johnson", date: "2025-09-16", amount_cents: 8209, type: "Web Design" },
  { name: "Carl wilson", date: "2025-09-15", amount_cents: 11791, type: "Mobile Design" },
  { name: "Annie Pursel", date: "2025-09-08", amount_cents: 20000, type: "Web Design" },
  { name: "Juan Carlos Morales", date: "2025-09-01", amount_cents: 4585, type: "Web Design" },
  { name: "Victoria Pancione", date: "2025-09-01", amount_cents: 15415, type: "Software Development" },
  { name: "Chris Pinto", date: "2025-08-26", amount_cents: 4585, type: "Web Design" },
  { name: "Miguel Martinez", date: "2025-08-25", amount_cents: 15415, type: "Software Development" },
  { name: "Nathan Thimmesch", date: "2025-08-19", amount_cents: 20000, type: "Web Design" },
  { name: "Ramin B.", date: "2025-08-11", amount_cents: 20000, type: "Web Design" },
  { name: "Aaron Rian", date: "2025-08-05", amount_cents: 20000, type: "Web Design" },
  { name: "Barry Shapiro", date: "2025-07-28", amount_cents: 20000, type: "Web Design" },
  { name: "Swaranshu borgaonkar", date: "2025-07-25", amount_cents: 14392, type: "Software Development", note: "Refund denied" },
  { name: "Terri Rivers", date: "2025-07-22", amount_cents: 5608, type: "Web Design" },
  { name: "Alphonse Bosquet", date: "2025-07-16", amount_cents: 10668, type: "Web Design", note: "Refunded $106.68" },
  { name: "Muhammad Khan", date: "2025-07-15", amount_cents: 5031, type: "Web Design" },
  { name: "Stacyann Ferguson", date: "2025-07-15", amount_cents: 23469, type: "Web Design" },
  { name: "Tyler Knecht", date: "2025-07-14", amount_cents: 30000, type: "Web Design" },
  { name: "Yolanda Sapp", date: "2025-07-14", amount_cents: 20000, type: "Web Design" },
];

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  // Check if already imported (prevent double-run)
  const { count } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("vendor", "Thumbtack")
    .eq("category", "lead_fees");

  if (count && count >= THUMBTACK_LEADS.length) {
    return NextResponse.json({
      message: "Thumbtack leads appear to already be imported",
      existing_count: count,
    });
  }

  // Clean up old manual bulk Thumbtack entries that are now replaced by per-lead imports
  // These were manually entered before the detailed import existed
  await supabase
    .from("expenses")
    .delete()
    .eq("org_id", orgId)
    .eq("vendor", "Thumbtack")
    .neq("category", "lead_fees")
    .ilike("description", "%thumbtack%");

  // Fetch all clients to match by name
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("org_id", orgId);

  const clientMap = new Map<string, string>();
  (clients ?? []).forEach(c => {
    if (c.name) {
      clientMap.set(c.name.toLowerCase().trim(), c.id);
    }
  });

  let imported = 0;
  let matched = 0;
  let unmatched = 0;
  const results: { name: string; amount: string; client_matched: boolean; note?: string }[] = [];

  for (const lead of THUMBTACK_LEADS) {
    const clientId = clientMap.get(lead.name.toLowerCase().trim()) || null;
    const wasConverted = !!clientId;

    if (wasConverted) matched++;
    else unmatched++;

    const notes = [
      `Thumbtack lead - ${lead.type}`,
      lead.note ? lead.note : null,
      !wasConverted ? "Lead not converted" : null,
    ].filter(Boolean).join(". ");

    const { error } = await supabase
      .from("expenses")
      .insert({
        org_id: orgId,
        description: `Thumbtack lead fee - ${lead.name}`,
        amount_cents: lead.amount_cents,
        expense_date: lead.date,
        category: "lead_fees",
        vendor: "Thumbtack",
        client_id: clientId,
        is_billable: false,
        is_tax_deductible: true,
        notes,
      });

    if (!error) {
      imported++;
    }

    results.push({
      name: lead.name,
      amount: `$${(lead.amount_cents / 100).toFixed(2)}`,
      client_matched: wasConverted,
      note: lead.note || undefined,
    });
  }

  const totalSpent = THUMBTACK_LEADS.reduce((sum, l) => sum + l.amount_cents, 0);

  return NextResponse.json({
    total_leads: THUMBTACK_LEADS.length,
    imported,
    clients_matched: matched,
    leads_not_converted: unmatched,
    total_spent: `$${(totalSpent / 100).toFixed(2)}`,
    results,
  });
}

// GET for info
export async function GET() {
  const totalSpent = THUMBTACK_LEADS.reduce((sum, l) => sum + l.amount_cents, 0);
  return NextResponse.json({
    message: "Thumbtack lead fee import endpoint",
    total_leads: THUMBTACK_LEADS.length,
    total_amount: `$${(totalSpent / 100).toFixed(2)}`,
    usage: "POST to import all leads as expenses",
  });
}
