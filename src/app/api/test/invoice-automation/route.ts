import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";

export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const { invoice_id } = await req.json();
    
    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';

    // Test signing automation
    const signingResponse = await fetch(`${baseUrl}/api/test/signing-automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id })
    });
    const signingResult = await signingResponse.json();

    // Test payment automation  
    const paymentResponse = await fetch(`${baseUrl}/api/test/payment-automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id })
    });
    const paymentResult = await paymentResponse.json();

    return NextResponse.json({
      success: true,
      message: "Complete invoice automation test completed",
      invoice_id,
      results: {
        signing_automation: {
          working: signingResult.results?.automation_working || false,
          details: signingResult.results
        },
        payment_automation: {
          working: paymentResult.results?.automation_working || false,
          details: paymentResult.results
        }
      },
      summary: {
        both_working: (signingResult.results?.automation_working && paymentResult.results?.automation_working),
        signing_only: signingResult.results?.automation_working,
        payment_only: paymentResult.results?.automation_working,
        issues: []
      }
    });

  } catch (error) {
    console.error("Combined automation test error:", error);
    return NextResponse.json({ 
      error: "Combined test failed", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}