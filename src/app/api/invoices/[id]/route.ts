import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  
  const { id: invoiceId } = await ctx.params;
  const { amount_cents, description, status, issued_at, due_at } = await req.json();

  if (!amount_cents || amount_cents <= 0) {
    return NextResponse.json({ error: "Amount is required and must be positive" }, { status: 400 });
  }

  const supabase = await supabaseServer();

  try {
    // Verify invoice belongs to org
    const { data: invoice, error: lookupError } = await supabase
      .from("invoices")
      .select("id, org_id, client_id, status")
      .eq("id", invoiceId)  
      .eq("org_id", orgId)
      .single();

    if (lookupError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Prepare update payload
    const updatePayload: any = {
      amount_cents,
      description,
      status,
      updated_at: new Date().toISOString(),
    };

    // Only update dates if they are provided
    if (issued_at) {
      updatePayload.issued_at = issued_at;
    }
    if (due_at) {
      updatePayload.due_at = due_at;
    }

    // If changing status to paid, set paid_at timestamp
    if (status === 'paid' && invoice.status !== 'paid') {
      updatePayload.paid_at = new Date().toISOString();
    }
    // If changing away from paid, clear paid_at
    else if (status !== 'paid' && invoice.status === 'paid') {
      updatePayload.paid_at = null;
    }

    // Update the invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
    }

    return NextResponse.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error("Error in invoice update:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { hard = true } = await req.json().catch(() => ({ hard: true }));

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, client_id, stripe_invoice_id")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (invErr || !inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Touch Stripe if mirrored there
  if (inv.stripe_invoice_id) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    try {
      const s = await stripe.invoices.retrieve(inv.stripe_invoice_id);
      if (s.status === "paid") {
        return NextResponse.json({ error: "Paid invoices cannot be deleted." }, { status: 409 });
      }
      if (s.status === "draft") {
        if (typeof s.id === "string") {
          await stripe.invoices.del(s.id);
        } else {
          throw new Error("Stripe invoice id is undefined.");
        }
      } else if (s.status !== "void") {
        if (typeof s.id === "string") {
          await stripe.invoices.voidInvoice(s.id);
        } else {
          throw new Error("Stripe invoice id is undefined.");
        }
      }
    } catch {
      // If it doesn't exist in Stripe anymore, continue and delete locally.
    }
  }

  if (hard) {
    const { error } = await supabase.from("invoices").delete().eq("id", id).eq("org_id", orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, deleted: true });
  } else {
    const { data: updated, error } = await supabase
      .from("invoices")
      .update({ status: "void" })
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id,stripe_invoice_id,status,amount_cents,issued_at,due_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, deleted: false, invoice: updated });
  }
}
