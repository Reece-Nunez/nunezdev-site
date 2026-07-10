/**
 * Reads Claude call telemetry for the AI-usage dashboard. The rows live in two
 * places -- public.llm_calls (CRM) and leadgen.llm_calls (the lead-gen pipeline)
 * -- so aggregation happens in the `ai_usage_summary` Postgres function
 * (SECURITY DEFINER; it can read the leadgen schema PostgREST doesn't expose and
 * the RLS-locked tables). We call it via the service-role client.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface UsageGroup {
  source: string; // 'crm' | 'pipeline'
  call_site: string;
  model: string | null;
  calls: number;
  failures: number;
  cost_usd: number;
  avg_latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
}

export interface UsageTotals {
  calls: number;
  failures: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  failure_rate: number; // 0..1
}

export interface UsageSummary {
  totals: UsageTotals;
  groups: UsageGroup[];
}

/** Roll grouped rows into totals. Pure, so it's unit-tested without a DB. */
export function summarize(groups: UsageGroup[]): UsageSummary {
  const totals: UsageTotals = {
    calls: 0, failures: 0, cost_usd: 0, input_tokens: 0, output_tokens: 0, failure_rate: 0,
  };
  for (const g of groups) {
    totals.calls += g.calls;
    totals.failures += g.failures;
    totals.cost_usd += g.cost_usd;
    totals.input_tokens += g.input_tokens;
    totals.output_tokens += g.output_tokens;
  }
  totals.failure_rate = totals.calls > 0 ? totals.failures / totals.calls : 0;
  return { totals, groups };
}

/** Postgres numeric/bigint come back as strings over JSON; coerce safely. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Fetch + aggregate the last `days` of telemetry across both apps. Best-effort:
 *  an RPC failure (e.g. before the function is deployed) yields an empty summary
 *  rather than throwing, so the dashboard degrades to a clean "no data" state. */
export async function getAiUsage(days = 30): Promise<UsageSummary> {
  const { data, error } = await supabaseAdmin().rpc("ai_usage_summary", { p_days: days });
  if (error || !Array.isArray(data)) {
    if (error) console.error("[aiUsage] ai_usage_summary rpc failed:", error.message);
    return summarize([]);
  }
  const groups: UsageGroup[] = (data as Record<string, unknown>[]).map((r) => ({
    source: String(r.source ?? "?"),
    call_site: String(r.call_site ?? "?"),
    model: (r.model as string | null) ?? null,
    calls: num(r.calls),
    failures: num(r.failures),
    cost_usd: num(r.cost_usd),
    avg_latency_ms: r.avg_latency_ms == null ? null : num(r.avg_latency_ms),
    input_tokens: num(r.input_tokens),
    output_tokens: num(r.output_tokens),
  }));
  return summarize(groups);
}
