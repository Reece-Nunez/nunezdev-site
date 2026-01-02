import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { generatePDF } from "@/lib/pdf/puppeteer-service";
import { generateTaxSummaryHTML, TaxDocumentData, TaxInvoiceSummary } from "@/lib/pdf-templates/tax-invoice-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ clientId: string }> };

async function requireAuthedOrgId() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" as const } };

  const { data: m, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (error) return { ok: false as const, status: 400 as const, json: { error: error.message } };
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" as const } };

  return { ok: true as const, supabase, orgId, user };
}

/** GET: Generate PDF tax document for a client's invoices in a given year */
export async function GET(req: Request, ctx: Ctx) {
  const { clientId } = await ctx.params;
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10);

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
  }

  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
  const { supabase, orgId } = gate;

  // Fetch client info
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, email, company")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Fetch all invoices for this client in the specified year
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  const { data: invoices, error: invoiceErr } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      status,
      amount_cents,
      issued_at,
      total_paid_cents
    `)
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .gte("issued_at", startDate)
    .lte("issued_at", endDate)
    .neq("status", "draft")
    .neq("status", "void")
    .order("issued_at", { ascending: true });

  if (invoiceErr) {
    return NextResponse.json({ error: invoiceErr.message }, { status: 400 });
  }

  // Transform invoices to our template format
  const invoiceSummaries: TaxInvoiceSummary[] = (invoices || []).map(inv => ({
    invoiceNumber: inv.invoice_number || `INV-${inv.id.slice(0, 8)}`,
    issuedAt: inv.issued_at,
    amountCents: inv.amount_cents || 0,
    status: inv.status || 'sent',
    totalPaidCents: inv.total_paid_cents || 0,
  }));

  // Calculate totals
  const totalInvoiced = invoiceSummaries.reduce((sum, inv) => sum + inv.amountCents, 0);
  const totalPaid = invoiceSummaries.reduce((sum, inv) => sum + inv.totalPaidCents, 0);
  const balanceDue = totalInvoiced - totalPaid;

  // Build template data
  const templateData: TaxDocumentData = {
    client: {
      id: client.id,
      name: client.name || 'Unknown Client',
      company: client.company,
      email: client.email,
    },
    year,
    invoices: invoiceSummaries,
    totals: {
      totalInvoiced,
      totalPaid,
      balanceDue,
    },
  };

  // Generate HTML
  const html = generateTaxSummaryHTML(templateData);

  // Generate PDF
  try {
    const pdfData = await generatePDF(html);

    const filename = `${client.name || 'client'}_tax_summary_${year}.pdf`.replace(/[^a-zA-Z0-9_-]/g, '_');

    return new Response(pdfData, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfData.byteLength),
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
