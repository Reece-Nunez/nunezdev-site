import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = await supabaseServer();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    // Get all payments with a Stripe payment intent but no fee recorded
    const { data: payments, error: fetchError } = await supabase
      .from("invoice_payments")
      .select("id, stripe_payment_intent_id")
      .not("stripe_payment_intent_id", "is", null)
      .or("stripe_fee_cents.is.null,stripe_fee_cents.eq.0");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ message: "No payments need backfilling", total: 0, backfilled: 0, failed: 0 });
    }

    let backfilled = 0;
    let failed = 0;
    const errors: { id: string; error: string }[] = [];

    for (const payment of payments) {
      try {
        // Get the payment intent to find the charge
        const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
          expand: ['latest_charge'],
        });

        const charge = pi.latest_charge as Stripe.Charge | null;
        if (!charge || !charge.balance_transaction) {
          errors.push({ id: payment.id, error: 'No charge or balance transaction found' });
          failed++;
          continue;
        }

        const balanceTxnId = typeof charge.balance_transaction === 'string'
          ? charge.balance_transaction
          : charge.balance_transaction.id;
        const balanceTxn = await stripe.balanceTransactions.retrieve(balanceTxnId);
        const feeCents = balanceTxn.fee || 0;

        const { error: updateError } = await supabase
          .from("invoice_payments")
          .update({ stripe_fee_cents: feeCents })
          .eq("id", payment.id);

        if (updateError) {
          errors.push({ id: payment.id, error: updateError.message });
          failed++;
        } else {
          backfilled++;
        }
      } catch (err) {
        errors.push({ id: payment.id, error: err instanceof Error ? err.message : String(err) });
        failed++;
      }
    }

    return NextResponse.json({
      total: payments.length,
      backfilled,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error backfilling stripe fees:", error);
    return NextResponse.json({
      error: "Backfill failed",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
