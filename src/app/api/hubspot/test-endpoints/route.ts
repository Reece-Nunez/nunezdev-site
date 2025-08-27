import { NextResponse } from "next/server";
import { hsGet } from "@/lib/hubspot";

export async function GET() {
  const testEndpoints = [
    "/crm/v3/objects/payments",
    "/crm/v3/objects/commerce_payments", 
    "/crm/v3/objects/payment",
    "/crm/v3/objects/invoices",
    "/crm/v4/objects/payments",
    "/crm/v4/objects/commerce_payments"
  ];

  const results: Record<string, any> = {};

  // Test commerce_payments with different property requests
  const commercePaymentTests = [
    { name: "basic", params: { limit: "1" } },
    { name: "with_properties", params: { limit: "1", properties: "amount,payment_date,payment_method,status" } },
    { name: "with_hs_properties", params: { limit: "1", properties: "hs_payment_amount,hs_payment_date,hs_payment_method,hs_payment_status" } },
    { name: "all_properties", params: { limit: "1", properties: "" } },
    { name: "with_associations", params: { limit: "1", associations: "deals,contacts,invoices" } }
  ];

  results["commerce_payments_tests"] = {};
  
  for (const test of commercePaymentTests) {
    try {
      console.log(`Testing commerce_payments with ${test.name}`);
      const response = await hsGet("/crm/v3/objects/commerce_payments", test.params);
      results["commerce_payments_tests"][test.name] = {
        success: true,
        hasResults: response?.results?.length > 0,
        resultCount: response?.results?.length || 0,
        sampleFields: response?.results?.[0] ? Object.keys(response.results[0].properties || {}) : [],
        sampleRecord: response?.results?.[0] || null
      };
    } catch (error) {
      results["commerce_payments_tests"][test.name] = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Also test the schema endpoint to see what objects are available
  try {
    const schemaResponse = await hsGet("/crm/v3/schemas");
    results["schemas"] = {
      success: true,
      availableObjects: schemaResponse?.results?.map((obj: any) => obj.name) || []
    };
  } catch (error) {
    results["schemas"] = {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  return NextResponse.json({
    message: "HubSpot endpoint test results",
    results
  });
}