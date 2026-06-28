/**
 * One place to construct the Anthropic client and pick the model, so every
 * AI feature (invoice line-item generation, proposal drafting, …) stays on the
 * same model and key handling instead of each route hardcoding its own.
 *
 * Model: defaults to Claude Opus 4.8 (current most-capable). Override with the
 * ANTHROPIC_MODEL env var to trade down for cost (e.g. claude-sonnet-4-6) without
 * touching code.
 */
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-8";

/** Thrown when the API key is missing, so routes can return a clean 500. */
export class MissingAnthropicKeyError extends Error {
  constructor() {
    super("Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment.");
    this.name = "MissingAnthropicKeyError";
  }
}

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingAnthropicKeyError();
  return new Anthropic({ apiKey });
}

export { Anthropic };

/**
 * Pull the first JSON object out of a model response. Models sometimes wrap JSON
 * in a ```json fence or add a sentence of preamble; this tolerates both and
 * falls back to the outermost braces. Returns null if nothing parses — callers
 * decide what to do with that.
 */
export function extractJsonObject<T = unknown>(text: string): T | null {
  if (!text) return null;
  let candidate = text.trim();

  // Strip a markdown code fence if present.
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fall back to the outermost { ... } span (handles stray preamble/suffix).
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(candidate.slice(first, last + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
