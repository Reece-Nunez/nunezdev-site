import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { amount_cents, subtotal_cents, tax_cents, discount_cents } = await req.json();

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
      .select("id")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Validate amounts
    const updates: any = {};
    
    if (typeof amount_cents === 'number') {
      updates.amount_cents = amount_cents;
    }
    if (typeof subtotal_cents === 'number') {
      updates.subtotal_cents = subtotal_cents;
    }
    if (typeof tax_cents === 'number') {
      updates.tax_cents = tax_cents;
    }
    if (typeof discount_cents === 'number') {
      updates.discount_cents = discount_cents;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid amount fields provided" }, { status: 400 });
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
      message: "Invoice amounts updated successfully",
      updates 
    });

  } catch (error) {
    console.error('Update amount error:', error);
    return NextResponse.json({ 
      error: "Failed to update invoice amounts" 
    }, { status: 500 });
  }
}