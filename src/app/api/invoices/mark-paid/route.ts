import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MarkPaidRequest {
  invoice_ids: string[];
  payment_method?: string; // 'cash', 'check', 'bank_transfer', 'other'
  notes?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = guard.orgId!;

  try {
    const body: MarkPaidRequest = await req.json();
    const { invoice_ids, payment_method = 'other', notes } = body;

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one invoice" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    // Fetch all selected invoices
    const { data: invoices, error: fetchError } = await supabase
      .from("invoices")
      .select("id, status, amount_cents, invoice_number, client_id")
      .eq("org_id", orgId)
      .in("id", invoice_ids);

    if (fetchError || !invoices) {
      console.error("Error fetching invoices:", fetchError);
      return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
    }

    if (invoices.length !== invoice_ids.length) {
      return NextResponse.json(
        { error: "Some invoices were not found" },
        { status: 404 }
      );
    }

    // Validate invoice statuses (can't mark already paid or voided invoices)
    const invalidInvoices = invoices.filter(inv =>
      inv.status === 'paid' || inv.status === 'void'
    );
    if (invalidInvoices.length > 0) {
      const numbers = invalidInvoices.map(inv => inv.invoice_number || inv.id.slice(0, 8)).join(', ');
      return NextResponse.json(
        { error: `Cannot mark paid or voided invoices as paid: ${numbers}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const results: { id: string; success: boolean; error?: string }[] = [];

    // Mark each invoice as paid and record the payment
    for (const invoice of invoices) {
      try {
        // Update invoice status to paid
        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            status: 'paid',
            paid_at: now,
          })
          .eq("id", invoice.id)
          .eq("org_id", orgId);

        if (updateError) {
          results.push({ id: invoice.id, success: false, error: updateError.message });
          continue;
        }

        // Record the payment in invoice_payments table
        const { error: paymentError } = await supabase
          .from("invoice_payments")
          .insert({
            invoice_id: invoice.id,
            amount_cents: invoice.amount_cents,
            payment_method: payment_method || 'manual',
            paid_at: now,
            metadata: {
              source: 'manual_mark_paid',
              notes: notes || `Manually marked as paid`,
              marked_at: now,
            },
          });

        if (paymentError) {
          console.error("Error recording payment:", paymentError);
          // Don't fail - invoice is already marked paid
        }

        results.push({ id: invoice.id, success: true });
      } catch (err) {
        results.push({
          id: invoice.id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: failCount === 0
        ? `Successfully marked ${successCount} invoice${successCount > 1 ? 's' : ''} as paid`
        : `Marked ${successCount} invoice${successCount > 1 ? 's' : ''} as paid, ${failCount} failed`,
      results,
      marked_count: successCount,
      failed_count: failCount,
    });

  } catch (error) {
    console.error("Error marking invoices as paid:", error);
    return NextResponse.json({ error: "Failed to mark invoices as paid" }, { status: 500 });
  }
}
