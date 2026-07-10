import { requireOwner } from "@/lib/authz";
import { getAiUsage } from "@/lib/aiUsage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n > 0 && n < 1 ? 4 : 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function sourceLabel(s: string): string {
  return s === "pipeline" ? "Lead-gen pipeline" : "CRM";
}

export default async function AiUsagePage() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access.
        </div>
      </div>
    );
  }

  const { totals, groups } = await getAiUsage(30);

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI usage &amp; cost</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every Claude call across the CRM and the lead-gen pipeline, last 30 days.
        </p>
      </div>

      {totals.calls === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
          No Claude calls recorded yet. Usage appears here once the AI features
          (proposal, invoice, and reply drafting, plus the lead-gen pipeline) run
          with the telemetry deployed.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Spend (30d)" value={usd(totals.cost_usd)} />
            <Metric label="Calls" value={num(totals.calls)} />
            <Metric
              label="Failure rate"
              value={`${(totals.failure_rate * 100).toFixed(1)}%`}
              sub={`${num(totals.failures)} failed`}
            />
            <Metric
              label="Tokens"
              value={`${num(totals.input_tokens)} in`}
              sub={`${num(totals.output_tokens)} out`}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">By feature &amp; model</h2>
            <div className="rounded-xl border bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Feature</th>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 font-medium text-right">Calls</th>
                    <th className="px-4 py-2 font-medium text-right">Fail</th>
                    <th className="px-4 py-2 font-medium text-right">Cost</th>
                    <th className="px-4 py-2 font-medium text-right">Avg ms</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groups.map((g, i) => (
                    <tr key={`${g.source}-${g.call_site}-${g.model}-${i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-600">{sourceLabel(g.source)}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{g.call_site}</td>
                      <td className="px-4 py-2 text-gray-600">{g.model ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(g.calls)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${g.failures ? "text-red-600" : "text-gray-400"}`}>
                        {g.failures ? num(g.failures) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{usd(g.cost_usd)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                        {g.avg_latency_ms == null ? "—" : num(Math.round(g.avg_latency_ms))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">
              Best-effort telemetry: costs are computed from token counts and a
              price table, so treat them as close estimates, not the invoice.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
