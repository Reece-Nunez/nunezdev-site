import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseServer } from "@/lib/supabaseServer";
import { generatePDF } from "@/lib/pdf/puppeteer-service";
import { generateClientReportHTML, ClientReportData } from "@/lib/pdf-templates/client-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

/** POST: Generate PDF and send to client via email */
export async function POST(_req: Request, ctx: Ctx) {
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

  if (!client.email) {
    return NextResponse.json({ error: "Client has no email address" }, { status: 400 });
  }

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
  const monthLabel = new Date(report.report_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const filename = `${client.name}_Report_${monthLabel}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

  // Generate PDF
  let pdfData: ArrayBuffer;
  try {
    pdfData = await generatePDF(html);
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  // Send email
  if (!resend) {
    console.log(`📧 EMAIL WOULD BE SENT to ${client.email}: Monthly Report - ${monthLabel}`);
    // Still update sent_at in dev mode
    await supabase
      .from("client_reports")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ success: true, messageId: "no-email-service" });
  }

  try {
    const pdfBuffer = Buffer.from(pdfData);

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "NunezDev <reports@nunezdev.com>",
      to: client.email,
      subject: `Monthly Technical Report - ${monthLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          </style>
        </head>
        <body>
          <div style="border-bottom: 3px solid #ffc312; padding-bottom: 16px; margin-bottom: 24px;">
            <h2 style="color: #1a1a2e; margin: 0;">Monthly Technical Report</h2>
            <p style="color: #6b7280; margin: 4px 0 0 0;">${monthLabel}</p>
          </div>
          <p>Hi ${client.name},</p>
          <p>Please find attached your monthly technical partner report for ${monthLabel}. This report covers the maintenance, monitoring, and improvements performed on your website this month.</p>
          <p>If you have any questions about the report or would like to discuss any of the recommendations, please don't hesitate to reach out.</p>
          <p style="margin-top: 24px;">Best regards,<br><strong>Reece Nunez</strong><br>NunezDev LLC</p>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
            NunezDev LLC &mdash; Technical Partner
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    // Update sent_at
    await supabase
      .from("client_reports")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true, messageId: emailResult?.id });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
