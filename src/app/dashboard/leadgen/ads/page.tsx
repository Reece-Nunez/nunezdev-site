import Link from "next/link";
import { requireOwner } from "@/lib/authz";
import { getAdsOverview } from "@/lib/googleAdsRead";
import { prettyEnum, type CampaignAgg, type KeywordAgg } from "@/lib/googleAdsTransform";
import RefreshAdsButton from "./RefreshAdsButton";
import AdsTrendChart from "./AdsTrendChart";
import {
  ChartBarIcon,
  ArrowLeftIcon,
  MegaphoneIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Supported trailing windows for the range selector.
const RANGES = [7, 30, 90] as const;

function usd(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}

function int(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

function num1(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
}

interface PageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function AdsDashboard({ searchParams }: PageProps) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access to view the ads dashboard.
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const rawDays = Number(params.days);
  const days = (RANGES as readonly number[]).includes(rawDays) ? rawDays : 30;

  const overview = await getAdsOverview(days);
  const { kpis } = overview;

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/dashboard/leadgen"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 mb-1"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Prospecting
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MegaphoneIcon className="w-6 h-6 text-gray-600" />
            Google Ads
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Campaign and keyword performance, synced from the Google Ads API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overview.lastSyncedAt && (
            <span className="text-xs text-gray-400">
              Synced {new Date(overview.lastSyncedAt).toLocaleString()}
            </span>
          )}
          {overview.configured && <RefreshAdsButton />}
        </div>
      </div>

      {/* ── Not configured: setup hint ─────────────────────────────── */}
      {!overview.configured ? (
        <div className="rounded-xl border bg-white p-6 text-sm space-y-3">
          <p className="font-medium text-gray-900">Google Ads isn&apos;t connected yet.</p>
          <p className="text-gray-700">
            Set the <code className="font-mono">GOOGLE_ADS_*</code> environment
            variables (developer token, OAuth client id/secret, refresh token,
            and customer id), then redeploy. Full step-by-step is in the README
            under <span className="font-medium">&ldquo;Google Ads integration&rdquo;</span>.
          </p>
          <p className="text-gray-500 text-xs">
            Once configured, the nightly cron backfills the last 30 days, or hit
            Refresh to pull immediately.
          </p>
        </div>
      ) : (
        <>
          {/* ── Range selector ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((r) => {
              const active = r === days;
              return (
                <Link
                  key={r}
                  href={`/dashboard/leadgen/ads?days=${r}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                    ${active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                >
                  Last {r} days
                </Link>
              );
            })}
          </div>

          {/* ── No data yet ─────────────────────────────────────────── */}
          {!overview.hasData ? (
            <div className="rounded-xl border bg-white p-6 text-sm space-y-3">
              <p className="font-medium text-gray-900">No data for this range yet.</p>
              <p className="text-gray-700">
                If you just connected the account, run the{" "}
                <code className="font-mono">create_google_ads_metrics.sql</code>{" "}
                migration in Supabase, then click <span className="font-medium">Refresh</span>{" "}
                to pull the latest metrics. The nightly cron keeps it current after that.
              </p>
            </div>
          ) : (
            <>
              {/* ── KPI cards ─────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <KpiCard label="Spend" value={usd(kpis.cost)} />
                <KpiCard label="Conversions" value={num1(kpis.conversions)} sub={`${usd(kpis.costPerConversion)} / conv`} />
                <KpiCard label="Clicks" value={int(kpis.clicks)} sub={`${usd(kpis.avgCpc)} avg CPC`} />
                <KpiCard label="Impressions" value={int(kpis.impressions)} sub={`${pct(kpis.ctr)} CTR`} />
                <KpiCard label="Conv. rate" value={pct(kpis.conversionRate)} />
                <KpiCard label="Conv. value" value={usd(kpis.conversionsValue)} />
              </div>

              {/* ── Trend chart ───────────────────────────────────────── */}
              <div className="rounded-xl border bg-white p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ChartBarIcon className="w-4 h-4" />
                  Spend vs conversions
                </div>
                <AdsTrendChart data={overview.series} />
              </div>

              {/* ── Campaign table ────────────────────────────────────── */}
              <CampaignTable campaigns={overview.campaigns} />

              {/* ── Keyword table ─────────────────────────────────────── */}
              <KeywordTable keywords={overview.keywords} />
            </>
          )}
        </>
      )}
    </div>
  );

  // Helper components share the formatters above via closure.
  function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
    );
  }

  function CampaignTable({ campaigns }: { campaigns: CampaignAgg[] }) {
    return (
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold text-gray-900">
          Campaigns
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-2 font-medium">Campaign</th>
                <th className="px-4 py-2 font-medium text-right">Spend</th>
                <th className="px-4 py-2 font-medium text-right">Clicks</th>
                <th className="px-4 py-2 font-medium text-right">CTR</th>
                <th className="px-4 py-2 font-medium text-right">Avg CPC</th>
                <th className="px-4 py-2 font-medium text-right">Conv.</th>
                <th className="px-4 py-2 font-medium text-right">Cost / conv</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaign_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{c.campaign_name}</div>
                    <div className="text-xs text-gray-400">
                      {prettyEnum(c.status)}
                      {c.channel_type ? ` · ${prettyEnum(c.channel_type)}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{usd(c.cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(c.clicks)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pct(c.ctr)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{usd(c.avgCpc)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{num1(c.conversions)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.conversions ? usd(c.costPerConversion) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function KeywordTable({ keywords }: { keywords: KeywordAgg[] }) {
    // Cap the rendered rows — the table is "top spenders", not an export.
    const top = keywords.slice(0, 50);
    return (
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold text-gray-900 flex items-center justify-between">
          <span>Keywords</span>
          {keywords.length > top.length && (
            <span className="text-xs font-normal text-gray-400">
              top {top.length} of {keywords.length} by spend
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-2 font-medium">Keyword</th>
                <th className="px-4 py-2 font-medium text-right">Spend</th>
                <th className="px-4 py-2 font-medium text-right">Clicks</th>
                <th className="px-4 py-2 font-medium text-right">CTR</th>
                <th className="px-4 py-2 font-medium text-right">Avg CPC</th>
                <th className="px-4 py-2 font-medium text-right">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {top.map((k) => (
                <tr key={k.criterion_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{k.keyword_text}</div>
                    <div className="text-xs text-gray-400">
                      {prettyEnum(k.match_type)} · {k.campaign_name}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{usd(k.cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(k.clicks)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pct(k.ctr)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{usd(k.avgCpc)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{num1(k.conversions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
