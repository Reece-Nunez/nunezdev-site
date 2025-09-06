import { NextResponse } from "next/server";
import { hsGet, HSListResp } from "@/lib/hubspot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HSInvoice = {
  id: string;
  properties?: Record<string, any>;
  associations?: {
    contacts?: { results?: { id: string }[] };
    deals?: { results?: { id: string }[] };
    companies?: { results?: { id: string }[] };
  };
};

export async function GET() {
  try {
    console.log(`[hubspot-debug] Fetching available invoice properties...`);

    // First get all available invoice properties
    const availableProperties = await hsGet<{
      results: Array<{
        name: string;
        label: string;
        type: string;
        description?: string;
      }>;
    }>('/crm/v3/properties/invoices');

    console.log(`[hubspot-debug] Found ${availableProperties.results.length} available invoice properties`);
    
    // Get first invoice with key properties we think should exist
    const hsInvoices = await hsGet<HSListResp<HSInvoice>>('/crm/v3/objects/invoices', {
      limit: '1',
      properties: availableProperties.results.map(p => p.name).join(','),
      associations: 'contacts,deals,companies'
    });

    if (hsInvoices.results.length === 0) {
      return NextResponse.json({ error: "No invoices found" }, { status: 404 });
    }

    const invoice = hsInvoices.results[0];
    
    console.log(`[hubspot-debug] Invoice ID: ${invoice.id}`);
    console.log(`[hubspot-debug] All properties:`, JSON.stringify(invoice.properties, null, 2));

    return NextResponse.json({
      invoice_id: invoice.id,
      available_properties: availableProperties.results.map(p => ({
        name: p.name,
        label: p.label,
        type: p.type,
        description: p.description
      })),
      sample_invoice_properties: invoice.properties,
      property_names: Object.keys(invoice.properties || {}),
      associations: invoice.associations
    });

  } catch (error: unknown) {
    console.error("[hubspot-debug] Fatal error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}