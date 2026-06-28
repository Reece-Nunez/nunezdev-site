/**
 * Drafting a full proposal from a short brief. The system prompt and the
 * response sanitizer live here (pure, unit-tested); the route in
 * app/api/proposals/generate wires them to the Anthropic client.
 */

export interface DraftLineItem {
  description: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
}

export interface ProposalDraft {
  title: string;
  project_overview: string;
  line_items: DraftLineItem[];
  terms_conditions: string;
  technology_stack: string[];
}

const DEFAULT_RATE_CENTS = 7500; // NunezDev default hourly rate ($75/hr)

export const PROPOSAL_SYSTEM_PROMPT = `You draft project proposals for NunezDev, a web development and design studio run by Reece Nunez. You turn a short brief into a complete, client-ready proposal.

VOICE
- Write like a skilled freelancer talking straight to a client: warm, confident, plain-spoken.
- First person ("I" or "we") is fine. Sound like a real person, not a brochure.
- No hype, no corporate filler, no buzzwords (avoid words like "elevate", "seamless", "robust", "leverage", "synergy", "cutting-edge", "in today's digital landscape").
- NEVER use em dashes or en dashes (— or –). Use periods, commas, or parentheses instead.
- Keep sentences clear and direct. Short is better than clever.

PRICING
- Default hourly rate is $75/hr (7500 cents) when work is time-based.
- For fixed deliverables or packages, set quantity = 1 and rate_cents = the full price in cents.
- Use realistic web-development pricing. Break the project into a few logical line items (typically 2 to 5).
- amount_cents MUST equal quantity * rate_cents.

OUTPUT
Respond with ONLY a JSON object, no preamble and no markdown fences:
{
  "title": "Short proposal title (e.g. 'Website Redesign for Acme Co')",
  "project_overview": "2 to 4 sentences describing the work, the goal, and what the client gets. In the voice above.",
  "line_items": [
    { "description": "What this covers", "quantity": <number>, "rate_cents": <integer>, "amount_cents": <integer> }
  ],
  "terms_conditions": "Plain-language terms: payment schedule, revisions, timeline expectations, what is and isn't included.",
  "technology_stack": ["Tech1", "Tech2"]
}`;

export function buildProposalUserPrompt(brief: string, clientName?: string): string {
  const who = clientName ? `Client: ${clientName}\n\n` : "";
  return `${who}Draft a proposal for this project:\n\n${brief.trim()}`;
}

function toStr(v: unknown, max: number, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  return v.trim().slice(0, max);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Coerce a raw model object into a safe ProposalDraft. Never throws: missing or
 * malformed fields fall back to sane defaults so the form always gets usable
 * data. Returns null only when there are no usable line items at all.
 */
export function sanitizeProposalDraft(raw: unknown): ProposalDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawItems = Array.isArray(obj.line_items) ? obj.line_items : [];
  const line_items: DraftLineItem[] = rawItems
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .map((it) => {
      const quantity = Math.max(0.25, toNum(it.quantity) || 1);
      const rate_cents = Math.max(0, Math.round(toNum(it.rate_cents) || DEFAULT_RATE_CENTS));
      return {
        description: toStr(it.description, 500, "Professional services"),
        quantity,
        rate_cents,
        amount_cents: Math.round(quantity * rate_cents),
      };
    })
    .filter((it) => it.amount_cents > 0);

  if (line_items.length === 0) return null;

  const technology_stack = Array.isArray(obj.technology_stack)
    ? obj.technology_stack
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return {
    title: toStr(obj.title, 150, "Project Proposal"),
    project_overview: toStr(obj.project_overview, 2000),
    line_items,
    terms_conditions: toStr(obj.terms_conditions, 4000),
    technology_stack,
  };
}
