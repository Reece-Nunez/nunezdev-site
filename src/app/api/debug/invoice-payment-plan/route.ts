import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await supabaseServer();
  const invoiceId = "724722c2-fd22-44d3-be97-b35a5b6d328b";

  try {
    // Check if payment plan installments exist
    const { data: installments, error } = await supabase
      .from("invoice_payment_plans")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("installment_number");

    return NextResponse.json({
      invoice_id: invoiceId,
      installments_found: installments?.length || 0,
      installments,
      error: error?.message
    });
  } catch (error) {
    return NextResponse.json({
      error: "Failed to check payment plan",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}