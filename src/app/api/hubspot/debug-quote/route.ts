import { NextResponse } from "next/server";
import { hsGet } from "@/lib/hubspot";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const quoteId = url.searchParams.get("id");
  
  if (!quoteId) {
    return NextResponse.json({ error: "Quote ID required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch a single quote with all available properties
    const quote = await hsGet<{ id: string; properties: Record<string, any> }>(`/crm/v3/objects/quotes/${quoteId}`);
    
    // Log all properties to see what's available
    console.log("Quote properties:", quote.properties);
    
    // Filter to show amount/price/money related properties
    const amountProps = Object.entries(quote.properties || {})
      .filter(([key, value]) => 
        key.toLowerCase().includes('amount') ||
        key.toLowerCase().includes('total') ||
        key.toLowerCase().includes('price') ||
        key.toLowerCase().includes('subtotal') ||
        key.toLowerCase().includes('tax') ||
        key.toLowerCase().includes('discount') ||
        key.toLowerCase().includes('value')
      );

    return NextResponse.json({
      quoteId: quote.id,
      allProperties: Object.keys(quote.properties || {}),
      amountRelatedProperties: Object.fromEntries(amountProps),
      allPropertiesForDebugging: quote.properties
    });
  } catch (error) {
    console.error("Debug quote error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to fetch quote" 
    }, { status: 500 });
  }
}