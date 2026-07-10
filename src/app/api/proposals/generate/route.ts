import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import {
  Anthropic,
  getAnthropicClient,
  AI_MODEL,
  extractJsonObject,
  MissingAnthropicKeyError,
} from "@/lib/ai/anthropic";
import {
  PROPOSAL_SYSTEM_PROMPT,
  buildProposalUserPrompt,
  sanitizeProposalDraft,
} from "@/lib/ai/proposalDraft";
import { recordedCreate } from "@/lib/ai/llmMetrics";

export const runtime = "nodejs";

// POST /api/proposals/generate - draft a full proposal from a short brief
export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let brief: string;
  let clientName: string | undefined;
  try {
    const body = await req.json();
    brief = body?.brief;
    clientName = typeof body?.client_name === "string" ? body.client_name : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!brief || typeof brief !== "string" || brief.trim().length === 0) {
    return NextResponse.json({ error: "Please describe the project" }, { status: 400 });
  }
  if (brief.length > 2000) {
    return NextResponse.json(
      { error: "Description too long. Please keep it under 2000 characters." },
      { status: 400 },
    );
  }

  try {
    const client = getAnthropicClient();

    const message = await recordedCreate(client, "proposals.generate", {
      model: AI_MODEL,
      max_tokens: 3000,
      system: PROPOSAL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildProposalUserPrompt(brief, clientName) }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI");
    }

    const parsed = extractJsonObject(textBlock.text);
    const draft = sanitizeProposalDraft(parsed);

    if (!draft) {
      return NextResponse.json(
        { error: "Could not draft a proposal from that. Please add more detail and try again." },
        { status: 400 },
      );
    }

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof MissingAnthropicKeyError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "AI service is busy. Please try again in a moment." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "AI service error. Please try again." }, { status: 502 });
    }
    console.error("[proposals/generate] Error:", error);
    return NextResponse.json({ error: "Failed to draft proposal. Please try again." }, { status: 500 });
  }
}
