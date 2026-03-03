import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { id: clientId } = await context.params;
  const supabase = await supabaseServer();

  // Verify client belongs to org and get stripe_customer_id
  const { data: client } = await supabase
    .from("clients")
    .select("id, stripe_customer_id")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.stripe_customer_id) {
    return NextResponse.json({ payment_methods: [], has_consent: false });
  }

  try {
    // Fetch saved payment methods from Stripe
    const methods = await stripe.paymentMethods.list({
      customer: client.stripe_customer_id,
      type: "card",
    });

    // Check consent metadata on the Stripe customer
    const customer = await stripe.customers.retrieve(client.stripe_customer_id);
    const hasConsent =
      !customer.deleted && customer.metadata?.card_on_file_consent === "true";

    const paymentMethods = methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "unknown",
      last4: pm.card?.last4 ?? "????",
      exp_month: pm.card?.exp_month ?? 0,
      exp_year: pm.card?.exp_year ?? 0,
    }));

    return NextResponse.json({ payment_methods: paymentMethods, has_consent: hasConsent });
  } catch (error: any) {
    console.error("Error fetching payment methods:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    );
  }
}
