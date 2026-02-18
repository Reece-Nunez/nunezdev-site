import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const supabase = await supabaseServer();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    // Get all active Stripe payment links that reference our invoices
    const activeLinks: Stripe.PaymentLink[] = [];
    for await (const link of stripe.paymentLinks.list({ active: true, limit: 100 })) {
      // Only consider links that have our invoice metadata
      if (link.metadata?.invoice_id && link.metadata?.source === 'stripe_payment_link') {
        activeLinks.push(link);
      }
    }

    // Get all current installment payment link IDs from the DB for this org
    const { data: currentInstallments, error: fetchError } = await supabase
      .from("invoice_payment_plans")
      .select("stripe_payment_link_id, invoice_id, invoices!inner(org_id)")
      .eq("invoices.org_id", orgId)
      .not("stripe_payment_link_id", "is", null);

    if (fetchError) {
      console.error("Error fetching installments:", fetchError);
      return NextResponse.json({
        error: "Failed to fetch installments",
        details: fetchError.message
      }, { status: 500 });
    }

    const validLinkIds = new Set(
      (currentInstallments || []).map((i: any) => i.stripe_payment_link_id)
    );

    // Find orphaned links: active in Stripe but not in our DB
    const orphaned = activeLinks.filter(link => !validLinkIds.has(link.id));

    // Deactivate orphaned links
    const results = {
      total_active_links: activeLinks.length,
      valid_links: validLinkIds.size,
      orphaned_found: orphaned.length,
      deactivated: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const link of orphaned) {
      try {
        await stripe.paymentLinks.update(link.id, { active: false });
        results.deactivated.push(link.id);
      } catch (err) {
        results.failed.push({
          id: link.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deactivated ${results.deactivated.length} orphaned payment link(s)`,
      ...results,
    });
  } catch (error) {
    console.error("Error cleaning up orphaned payment links:", error);
    return NextResponse.json({
      error: "Failed to cleanup orphaned payment links",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
