import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

// POST /api/time-entries/generate-invoice - Create invoice from time entries
export async function POST(request: NextRequest) {
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    const body = await request.json();
    const { entry_ids, client_id, hourly_rate_cents, title } = body;

    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return NextResponse.json({ error: "entry_ids array is required" }, { status: 400 });
    }

    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    if (!hourly_rate_cents || hourly_rate_cents <= 0) {
      return NextResponse.json({ error: "hourly_rate_cents must be positive" }, { status: 400 });
    }

    // Fetch the time entries
    const { data: entries, error: entriesError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "logged")
      .eq("billable", true)
      .in("id", entry_ids);

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "No billable logged entries found" }, { status: 400 });
    }

    // Group entries by project or create line items
    const lineItems = entries.map(entry => {
      const hours = entry.duration_minutes / 60;
      const amount_cents = Math.round(hours * hourly_rate_cents);
      return {
        title: entry.project || 'Development Work',
        description: entry.description,
        quantity: parseFloat(hours.toFixed(2)),
        rate_cents: hourly_rate_cents,
        amount_cents
      };
    });

    const subtotal_cents = lineItems.reduce((sum, item) => sum + item.amount_cents, 0);
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    // Generate invoice number
    const year = new Date().getFullYear();
    const { data: lastInvoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("org_id", orgId)
      .like("invoice_number", `INV-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastInvoice?.invoice_number) {
      const match = lastInvoice.invoice_number.match(/INV-\d{4}-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const invoice_number = `INV-${year}-${String(nextNum).padStart(4, '0')}`;

    // Calculate due date (Net 30)
    const due_at = new Date();
    due_at.setDate(due_at.getDate() + 30);

    // Create the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        client_id,
        invoice_number,
        title: title || `Development Services - ${totalHours} hours`,
        description: `Invoice generated from ${entries.length} time entries totaling ${totalHours} hours.`,
        line_items: lineItems,
        subtotal_cents,
        tax_cents: 0,
        discount_cents: 0,
        amount_cents: subtotal_cents,
        status: 'draft',
        issued_at: new Date().toISOString(),
        due_at: due_at.toISOString(),
        payment_terms: '30'
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    }

    // Mark time entries as billed and link to invoice
    const { error: updateError } = await supabase
      .from("time_entries")
      .update({
        status: 'billed',
        invoice_id: invoice.id,
        hourly_rate_cents // Store the rate used
      })
      .in("id", entry_ids)
      .eq("org_id", orgId);

    if (updateError) {
      console.error("Error marking entries as billed:", updateError);
      // Invoice was created, don't fail completely
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      total_hours: totalHours,
      total_amount_cents: subtotal_cents,
      entries_billed: entries.length
    });
  } catch (error) {
    console.error("Error in POST /api/time-entries/generate-invoice:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
