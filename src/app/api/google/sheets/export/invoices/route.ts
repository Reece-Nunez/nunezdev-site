import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { sheetsService } from "@/lib/google";

export async function POST() {
  const supabase = await supabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get org
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgId = memberships?.[0]?.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  if (!sheetsService.isAvailable()) {
    return NextResponse.json(
      { error: "Google Sheets integration not available" },
      { status: 503 }
    );
  }

  try {
    // Fetch all invoices with client info
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select(`
        invoice_number,
        status,
        issued_at,
        due_at,
        total_cents,
        paid_cents,
        balance_due_cents,
        clients (name)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Export to Google Sheets
    const result = await sheetsService.exportInvoices(
      (invoices || []).map((i: any) => ({
        invoiceNumber: i.invoice_number || "N/A",
        clientName: i.clients?.name || "Unknown",
        status: i.status || "draft",
        issuedAt: i.issued_at,
        dueAt: i.due_at,
        totalCents: i.total_cents || 0,
        paidCents: i.paid_cents || 0,
        balanceCents: i.balance_due_cents || 0,
      }))
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      invoiceCount: invoices?.length || 0,
    });
  } catch (error: any) {
    console.error("Invoice export failed:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}
