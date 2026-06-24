import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { requireProspecting } from "@/lib/authz";
import {
  isAvailable,
  getAnalytics,
  getIntegrationsHealth,
  type AnalyticsResult,
  type IntegrationsHealth,
} from "@/lib/leadgen-api";
import { googleServiceFactory } from "@/lib/google/googleServiceFactory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number | null): string {
  return n == null ? "—" : `${n}%`;
}

export default async function LeadgenHealth() {
  const guard = await requireProspecting();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access.
        </div>
      </div>
    );
  }

  const available = await isAvailable();

  let analytics: AnalyticsResult | null = null;
  let health: IntegrationsHealth | null = null;
  if (available) {
    [analytics, health] = await Promise.all([
      getAnalytics().catch(() => null),
      getIntegrationsHealth().catch(() => null),
    ]);
  }

  // Site-side integrations the pipeline can't see.
  const gmailReady = googleServiceFactory.isAvailable();

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <div className="space-y-2">
        <Link
          href="/dashboard/leadgen"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to prospecting
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health &amp; analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            What&apos;s wired up, and how the funnel is performing.
          </p>
        </div>
      </div>

      {!available && (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
          The pipeline API isn&apos;t reachable, so live health + analytics
          can&apos;t be shown. Check <code className="font-mono">LEADGEN_API_URL</code>.
        </div>
      )}

      {/* ── Funnel analytics ─────────────────────────────────────── */}
      {analytics && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Funnel</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Metric label="Reply rate" value={pct(analytics.reply_rate)}
              sub={`${analytics.reach} reached`} />
            <Metric label="Convert rate" value={pct(analytics.convert_rate)}
              sub={`${analytics.by_status.converted} converted`} />
            <Metric label="Email open rate" value={pct(analytics.open_rate)}
              sub={`${analytics.emails_opened}/${analytics.emails_delivered} opened`} />
            <Metric label="Follow-ups due" value={String(analytics.follow_ups_due)} />
            <Metric label="Emails sent" value={String(analytics.emails_sent)} />
            <Metric label="Replies" value={String(analytics.replies)} />
            <Metric label="Calls logged" value={String(analytics.calls_logged)} />
            <Metric label="Pipeline value" value={formatCurrency(analytics.pipeline_value)} />
          </div>
        </section>
      )}

      {/* ── Integration health ───────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Integrations</h2>
        <div className="rounded-xl border bg-white divide-y">
          <HealthRow ok={!!health?.database} label="Database (Supabase)"
            hint="Pipeline can reach Postgres" />
          <HealthRow ok={!!health?.anthropic} label="Claude (Anthropic)"
            hint="Research, proposals, outreach drafting" />
          <HealthRow ok={!!health?.google_places} label="Google Places"
            hint="Prospecting search" />
          <HealthRow ok={!!health?.resend} label="Resend (email send)"
            hint="Outreach + follow-up delivery" />
          <HealthRow ok={!!health?.resend_webhook} label="Resend webhook"
            hint="Delivery / open / bounce tracking — RESEND_WEBHOOK_SECRET" />
          <HealthRow ok={!!health?.twilio} label="Twilio (SMS)"
            hint="SMS send + inbound replies" />
          <HealthRow ok={!!health?.storage_s3} label="S3 storage"
            hint="Proposal PDFs + mockups" />
          <HealthRow ok={!!health?.public_base_url} label="Public base URL"
            hint="Preview links + webhook URLs" />
          <HealthRow ok={available} label="Pipeline API"
            hint="Dashboard → FastAPI service" />
          <HealthRow ok={gmailReady} label="Gmail (reply detection)"
            hint="Email-reply poller — service account + delegation" />
        </div>
      </section>
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

function HealthRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {ok ? (
        <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0" />
      ) : (
        <XCircleIcon className="w-5 h-5 text-gray-300 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{hint}</div>
      </div>
      <span className={`ml-auto text-xs font-medium ${ok ? "text-green-700" : "text-gray-400"}`}>
        {ok ? "Configured" : "Not set"}
      </span>
    </div>
  );
}
