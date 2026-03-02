import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { generatePDF } from "@/lib/pdf/puppeteer-service";
import { generateClientReportHTML, ClientReportData } from "@/lib/pdf-templates/client-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

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

/** GET: Generate and return PDF for a saved client report */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
  const { supabase, orgId } = gate;

  // Fetch the report with client info
  const { data: report, error } = await supabase
    .from("client_reports")
    .select("*, clients(name, email, company)")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const client = report.clients as { name: string; email: string | null; company: string | null };

  const reportData: ClientReportData = {
    client: {
      name: client.name,
      company: client.company,
      email: client.email,
    },
    reportMonth: report.report_month,
    ...(report.report_data as Omit<ClientReportData, 'client' | 'reportMonth'>),
  };

  const html = generateClientReportHTML(reportData);

  try {
    const pdfData = await generatePDF(html);
    const monthLabel = new Date(report.report_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const filename = `${client.name}_Report_${monthLabel}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

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
