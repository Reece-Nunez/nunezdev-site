"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeadSourceStat } from "@/lib/leadAnalytics";

// Inline label map — duplicates the server lib's keys so this client bundle
// doesn't have to import anything from leadAnalytics (which pulls supabaseAdmin).
const SOURCE_LABELS: Record<string, string> = {
  contact_page: "Contact page form",
  contact_form: "Contact form (legacy)",
  homepage_hero: "Homepage hero",
  free_website_audit: "Free audit magnet",
  web_design_ponca_city: "Ponca City landing",
  appointment: "Calendar booking",
  manual: "Manually added",
};
const labelForSource = (s: string) => SOURCE_LABELS[s] || s;

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

const fmtPct = (rate: number) => `${Math.round(rate * 100)}%`;

export default function LeadSourcesPanel() {
  const [stats, setStats] = useState<LeadSourceStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/lead-sources");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setStats(data.stats || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalLeads = stats?.reduce((s, r) => s + r.totalLeads, 0) ?? 0;
  const totalConverted = stats?.reduce((s, r) => s + r.convertedLeads, 0) ?? 0;
  const totalRevenue = stats?.reduce((s, r) => s + r.totalRevenueCents, 0) ?? 0;
  const overallConvRate = totalLeads > 0 ? totalConverted / totalLeads : 0;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">Lead Sources ROI</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Which forms and pages actually produce paying clients.
          </p>
        </div>
        <Link
          href="/dashboard/leads"
          className="text-sm text-emerald-600 hover:text-emerald-800"
        >
          View leads
        </Link>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
          Failed to load: {error}
        </div>
      )}

      {!stats && !error && (
        <div className="text-xs text-gray-500 text-center py-6">
          Crunching the numbers...
        </div>
      )}

      {stats && stats.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-6">
          No leads yet. Once form submissions roll in, you'll see per-source ROI here.
        </div>
      )}

      {stats && stats.length > 0 && (
        <>
          {/* Summary band — overall funnel snapshot */}
          <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-100">
            <div>
              <div className="text-xs text-gray-500">Total leads</div>
              <div className="text-lg font-semibold text-gray-900">{totalLeads}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Conversion</div>
              <div className="text-lg font-semibold text-gray-900">
                {totalConverted} <span className="text-sm text-gray-400">({fmtPct(overallConvRate)})</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Revenue</div>
              <div className="text-lg font-semibold text-emerald-600">{fmtCurrency(totalRevenue)}</div>
            </div>
          </div>

          {/* Per-source table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="pb-2">Source</th>
                  <th className="pb-2 text-right">Leads</th>
                  <th className="pb-2 text-right">Conv.</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2 text-right hidden sm:table-cell">Avg / client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.map((row) => (
                  <tr key={row.source}>
                    <td className="py-2 pr-2">
                      <div className="font-medium text-gray-900 text-sm">
                        {labelForSource(row.source)}
                      </div>
                    </td>
                    <td className="py-2 text-right text-gray-700">{row.totalLeads}</td>
                    <td className="py-2 text-right">
                      <span className="text-gray-700">{row.convertedLeads}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        ({fmtPct(row.conversionRate)})
                      </span>
                    </td>
                    <td className="py-2 text-right font-semibold text-emerald-600">
                      {row.totalRevenueCents > 0 ? fmtCurrency(row.totalRevenueCents) : "—"}
                    </td>
                    <td className="py-2 text-right text-gray-700 hidden sm:table-cell">
                      {row.avgRevenuePerClientCents > 0
                        ? fmtCurrency(row.avgRevenuePerClientCents)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
