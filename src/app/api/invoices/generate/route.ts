import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireOwner } from "@/lib/authz";

export const runtime = "nodejs";

interface GeneratedLineItem {
  title: string;
  description: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
  pricing_type: "time" | "value";
}

interface GeneratedInvoiceData {
  line_items: GeneratedLineItem[];
  project_overview?: string;
  technology_stack?: string[];
}

const systemPrompt = `You are an invoice line item generator for a web development and design agency called Nunez Development.

Given a project description, generate structured invoice data with line items.

PRICING MODELS - Determine which applies to each item:
1. TIME-BASED: Use when hours/time is mentioned or implied for ongoing work.
   - Set quantity = number of hours
   - Set rate_cents = hourly rate in cents (e.g., $100/hr = 10000)

2. VALUE-BASED: Use for fixed-price deliverables or packages.
   - Set quantity = 1
   - Set rate_cents = total price in cents (e.g., $1500 = 150000)

DEFAULTS:
- If no hourly rate specified for time-based work, use $75/hr (7500 cents)
- If hours not specified but work is described, estimate reasonable hours based on complexity
- Break down large projects into logical phases/components

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "line_items": [
    {
      "title": "Short descriptive title (3-6 words)",
      "description": "Detailed description of the work to be performed",
      "quantity": <number>,
      "rate_cents": <integer>,
      "amount_cents": <integer, must equal quantity * rate_cents>,
      "pricing_type": "time" | "value"
    }
  ],
  "project_overview": "1-2 sentence project summary (optional)",
  "technology_stack": ["Tech1", "Tech2"] // Include if technologies are mentioned or can be inferred
}

IMPORTANT:
- amount_cents MUST equal quantity * rate_cents
- rate_cents must be a positive integer
- quantity must be >= 0.25 for time-based, or 1 for value-based
- Generate realistic, professional line items a client would expect
- If the prompt is unclear, make reasonable assumptions for a typical web project`;

export async function POST(req: NextRequest) {
  // Verify authentication
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a project description" },
        { status: 400 }
      );
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "Description too long. Please keep it under 2000 characters." },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Generate invoice line items for this project:\n\n${prompt.trim()}`,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content from response
    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Parse JSON from response
    let generatedData: GeneratedInvoiceData;
    try {
      // Try to extract JSON from the response (handle potential markdown code blocks)
      let jsonText = textContent.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      generatedData = JSON.parse(jsonText);
    } catch {
      console.error("[AI Generate] Failed to parse JSON:", textContent.text);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Validate and sanitize line items
    if (!generatedData.line_items || !Array.isArray(generatedData.line_items)) {
      return NextResponse.json(
        { error: "Invalid response structure. Please try again." },
        { status: 500 }
      );
    }

    const validatedLineItems: GeneratedLineItem[] = generatedData.line_items
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const quantity = Math.max(0.25, Number(item.quantity) || 1);
        const rateCents = Math.max(100, Math.round(Number(item.rate_cents) || 7500));
        const amountCents = Math.round(quantity * rateCents);

        return {
          title: String(item.title || "").trim().slice(0, 100) || "Service",
          description: String(item.description || "").trim().slice(0, 500) || "Professional services",
          quantity,
          rate_cents: rateCents,
          amount_cents: amountCents,
          pricing_type: item.pricing_type === "value" ? "value" : "time",
        };
      });

    if (validatedLineItems.length === 0) {
      return NextResponse.json(
        { error: "Could not generate line items from that description. Please be more specific." },
        { status: 400 }
      );
    }

    // Sanitize optional fields
    const response: GeneratedInvoiceData = {
      line_items: validatedLineItems,
    };

    if (generatedData.project_overview && typeof generatedData.project_overview === "string") {
      response.project_overview = generatedData.project_overview.trim().slice(0, 500);
    }

    if (Array.isArray(generatedData.technology_stack)) {
      response.technology_stack = generatedData.technology_stack
        .filter((t) => typeof t === "string")
        .map((t) => t.trim().slice(0, 50))
        .slice(0, 10);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[AI Generate] Error:", error);

    // Handle rate limiting
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "AI service is busy. Please try again in a moment." },
        { status: 429 }
      );
    }

    // Handle API errors
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "AI service error. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate invoice data. Please try again." },
      { status: 500 }
    );
  }
}
