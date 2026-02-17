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
    // Fetch all clients
    const { data: clients, error } = await supabase
      .from("clients_overview")
      .select("name, email, phone, company, status, total_invoiced_cents, total_paid_cents, balance_due_cents")
      .eq("org_id", orgId)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Export to Google Sheets
    const result = await sheetsService.exportClients(
      (clients || []).map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        status: c.status,
        totalInvoiced: c.total_invoiced_cents || 0,
        totalPaid: c.total_paid_cents || 0,
        balance: c.balance_due_cents || 0,
      }))
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      clientCount: clients?.length || 0,
    });
  } catch (error: any) {
    console.error("Client export failed:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}
