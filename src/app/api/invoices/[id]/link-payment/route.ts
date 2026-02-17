import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import Stripe from "stripe";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  
  const { id } = await ctx.params;
  const { stripe_payment_intent_id, stripe_charge_id } = await req.json();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    // Verify the invoice belongs to the user's org
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, amount_cents")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const updates: any = {};
    let paymentVerified = false;

    // Verify and link payment intent
    if (stripe_payment_intent_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripe_payment_intent_id);
        
        if (paymentIntent.status === 'succeeded' && paymentIntent.amount === invoice.amount_cents) {
          updates.stripe_payment_intent_id = stripe_payment_intent_id;
          updates.status = 'paid';
          updates.paid_at = new Date(paymentIntent.created * 1000).toISOString();
          updates.payment_method = paymentIntent.payment_method_types?.[0] || 'card';
          paymentVerified = true;
        } else {
          return NextResponse.json({ 
            error: "Payment intent amount doesn't match invoice or payment not successful" 
          }, { status: 400 });
        }
      } catch (error) {
        return NextResponse.json({ 
          error: "Invalid payment intent ID" 
        }, { status: 400 });
      }
    }

    // Verify and link charge
    if (stripe_charge_id) {
      try {
        const charge = await stripe.charges.retrieve(stripe_charge_id);
        
        if (charge.status === 'succeeded' && charge.amount === invoice.amount_cents) {
          updates.stripe_charge_id = stripe_charge_id;
          if (!paymentVerified) {
            updates.status = 'paid';
            updates.paid_at = new Date(charge.created * 1000).toISOString();
            updates.payment_method = charge.payment_method_details?.type || 'card';
          }
          paymentVerified = true;
        } else {
          return NextResponse.json({ 
            error: "Charge amount doesn't match invoice or charge not successful" 
          }, { status: 400 });
        }
      } catch (error) {
        return NextResponse.json({ 
          error: "Invalid charge ID" 
        }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ 
        error: "No valid payment information provided" 
      }, { status: 400 });
    }

    // Update the invoice
    const { error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Payment linked successfully",
      updates 
    });

  } catch (error) {
    console.error('Link payment error:', error);
    return NextResponse.json({ 
      error: "Failed to link payment" 
    }, { status: 500 });
  }
}