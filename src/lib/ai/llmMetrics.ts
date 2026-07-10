/**
 * Per-call Claude telemetry for the CRM's AI routes. Records model, token counts
 * (incl. prompt-cache read/write), a computed USD cost, latency, stop_reason, and
 * success/failure to the `llm_calls` table -- the data these routes used to throw
 * away when they discarded `message.usage`.
 *
 * `recordedCreate()` is the drop-in: wrap it around `client.messages.create` and
 * it times the call, records a row on both success and failure, and re-throws so
 * each route's existing error handling is unchanged. The write is best-effort --
 * `recordLlmCall` swallows every error so telemetry can never break the
 * generation it measures. See database/migrations/create_llm_calls.sql.
 */
import AnthropicSDK from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AnthropicClient = AnthropicSDK;
type Message = AnthropicSDK.Messages.Message;
type CreateParams = AnthropicSDK.Messages.MessageCreateParamsNonStreaming;

// USD per 1,000,000 tokens, verified against the claude-api pricing reference
// (2026-06). Prompt-cache rates are derived: a 5-minute ephemeral cache WRITE
// bills at 1.25x the input rate and a READ at ~0.10x. Unknown models -> cost is
// null (token counts still recorded). Kept in sync with the pipeline's
// llm_metrics.py price table.
const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5.0, out: 25.0 },
  "claude-opus-4-7": { in: 5.0, out: 25.0 },
  "claude-opus-4-6": { in: 5.0, out: 25.0 },
  "claude-sonnet-5": { in: 3.0, out: 15.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
  "claude-fable-5": { in: 10.0, out: 50.0 },
};

/**
 * USD cost for one call, or null when the model has no price entry. Pure, so the
 * cost math is unit-testable without a DB or a real Message. Null token counts
 * are treated as 0.
 */
export function computeCostUsd(
  model: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  cacheReadTokens: number | null | undefined = 0,
  cacheWriteTokens: number | null | undefined = 0,
): number | null {
  const price = model ? PRICES[model] : undefined;
  if (!price) return null;
  const M = 1_000_000;
  let cost = ((inputTokens ?? 0) / M) * price.in;
  cost += ((outputTokens ?? 0) / M) * price.out;
  cost += ((cacheReadTokens ?? 0) / M) * price.in * CACHE_READ_MULT;
  cost += ((cacheWriteTokens ?? 0) / M) * price.in * CACHE_WRITE_MULT;
  return cost;
}

interface RecordArgs {
  callSite: string;
  message?: Message | null;
  latencyMs: number;
  ok: boolean;
  error?: unknown;
  entityId?: string | null;
}

/**
 * Insert one telemetry row. NEVER throws -- every failure (missing env, insert
 * error) is logged and swallowed so a telemetry problem can't break the AI
 * route. Fire it with `await` so the row is written before the serverless
 * function can freeze; the swallow keeps that await safe.
 */
export async function recordLlmCall(args: RecordArgs): Promise<void> {
  try {
    const usage = args.message?.usage;
    const model = args.message?.model ?? null;
    const cost = computeCostUsd(
      model,
      usage?.input_tokens,
      usage?.output_tokens,
      usage?.cache_read_input_tokens,
      usage?.cache_creation_input_tokens,
    );
    const errText = args.error
      ? args.error instanceof Error
        ? `${args.error.name}: ${args.error.message}`
        : String(args.error)
      : null;

    await supabaseAdmin()
      .from("llm_calls")
      .insert({
        call_site: args.callSite,
        model,
        input_tokens: usage?.input_tokens ?? null,
        output_tokens: usage?.output_tokens ?? null,
        cache_read_tokens: usage?.cache_read_input_tokens ?? null,
        cache_write_tokens: usage?.cache_creation_input_tokens ?? null,
        stop_reason: args.message?.stop_reason ?? null,
        latency_ms: args.latencyMs,
        ok: args.ok,
        error: errText,
        cost_usd: cost,
        entity_id: args.entityId ?? null,
      });
  } catch (e) {
    console.warn(`[llmMetrics] failed to record ${args.callSite}:`, e);
  }
}

/**
 * Time `client.messages.create(params)`, record a telemetry row (success or
 * failure), and return the Message. Re-throws on error so the caller's own
 * try/catch shapes the HTTP response exactly as before.
 */
export async function recordedCreate(
  client: AnthropicClient,
  callSite: string,
  params: CreateParams,
  opts?: { entityId?: string | null },
): Promise<Message> {
  const started = Date.now();
  try {
    const message = await client.messages.create(params);
    await recordLlmCall({
      callSite,
      message,
      latencyMs: Date.now() - started,
      ok: true,
      entityId: opts?.entityId,
    });
    return message;
  } catch (error) {
    await recordLlmCall({
      callSite,
      latencyMs: Date.now() - started,
      ok: false,
      error,
      entityId: opts?.entityId,
    });
    throw error;
  }
}
