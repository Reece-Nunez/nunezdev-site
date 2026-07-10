import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  Anthropic,
  getAnthropicClient,
  AI_MODEL,
  MissingAnthropicKeyError,
} from "@/lib/ai/anthropic";
import {
  THUMBTACK_REPLY_SYSTEM_PROMPT,
  buildReplyUserPrompt,
  sanitizeReply,
} from "@/lib/ai/thumbtackReply";
import { recordedCreate } from "@/lib/ai/llmMetrics";

export const runtime = "nodejs";

// POST /api/leads/[id]/draft-reply - AI-draft a first reply to a lead
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = supabaseAdmin();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("name, project_type, message, thumbtack_negotiation_id")
    .eq("id", id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Prefer the customer's actual latest message from the inbox thread; fall back
  // to the lead's stored message (Thumbtack message-stub leads have none).
  let theirMessage: string | null = lead.message;
  if (lead.thumbtack_negotiation_id) {
    const { data: convo } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_external_id", lead.thumbtack_negotiation_id)
      .limit(1);
    const convId = convo?.[0]?.id as string | undefined;
    if (convId) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("body_text")
        .eq("conversation_id", convId)
        .eq("direction", "inbound")
        .not("body_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (msgs?.[0]?.body_text) theirMessage = msgs[0].body_text as string;
    }
  }

  try {
    const client = getAnthropicClient();
    const message = await recordedCreate(
      client,
      "leads.draft_reply",
      {
        model: AI_MODEL,
        max_tokens: 600,
        system: THUMBTACK_REPLY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildReplyUserPrompt({
              leadName: lead.name,
              projectType: lead.project_type,
              theirMessage,
            }),
          },
        ],
      },
      { entityId: id },
    );

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response from AI");

    const draft = sanitizeReply(textBlock.text);
    if (!draft) {
      return NextResponse.json({ error: "AI returned an empty reply. Try again." }, { status: 502 });
    }
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof MissingAnthropicKeyError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI service is busy. Try again in a moment." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "AI service error. Try again." }, { status: 502 });
    }
    console.error("[leads/draft-reply] Error:", e);
    return NextResponse.json({ error: "Failed to draft reply." }, { status: 500 });
  }
}
