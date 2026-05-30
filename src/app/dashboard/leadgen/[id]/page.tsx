import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/authz";
import {
  getBusiness,
  type BusinessStatus,
  type OutreachRow,
} from "@/lib/leadgen-api";
import { businessOutputDirName } from "@/lib/leadgen-paths";
import { aiScoreClass } from "../utils";
import {
  ArrowLeftIcon,
  GlobeAltIcon,
  PhoneIcon,
  MapPinIcon,
  StarIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  PhoneArrowUpRightIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import StageButtons from "../StageButtons";
import SendEmailButton from "./SendEmailButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_STYLES: Record<BusinessStatus, string> = {
  new:             "bg-blue-50 text-blue-700 border-blue-200",
  researched:      "bg-purple-50 text-purple-700 border-purple-200",
  proposal_built:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  contacted:       "bg-gray-100 text-gray-700 border-gray-200",
};
const STATUS_LABELS: Record<BusinessStatus, string> = {
  new:             "New",
  researched:      "Researched",
  proposal_built:  "Proposal built",
  contacted:       "Contacted",
};

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadgenDetail({ params }: PageProps) {
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

  const { id: rawId } = await params;
  const businessId = Number.parseInt(rawId, 10);
  if (!Number.isInteger(businessId) || businessId <= 0) notFound();

  const detail = await getBusiness(businessId);
  if (!detail) notFound();

  // Decide whether to render the proposal / mockup iframes based on DB
  // state, NOT a filesystem check. In production the files live in S3
  // (Phase 2 M1b.1) — Vercel's filesystem doesn't have them, and even
  // for local dev the source of truth for "did the build succeed?" is
  // the pipeline's DB state, not whatever's left in the operator's
  // output/ directory.
  //
  //   - proposal.pdf: the pipeline only advances status to
  //     'proposal_built' (or beyond, 'contacted') when reportlab
  //     actually rendered + uploaded the PDF — see
  //     proposal_status_after_build() in builder.py.
  //   - mockup.html: gated on the mockup_html column being populated,
  //     which the build stage sets only after Claude's mockup call +
  //     storage.put succeeds.
  const outDir = businessOutputDirName(detail.id, detail.name);
  const hasProposalFile =
    detail.proposal != null &&
    (detail.status === "proposal_built" || detail.status === "contacted");
  const hasMockupFile = detail.proposal?.mockup_html != null;
  // Cache-bust the iframe src with the business's updated_at — bumped on
  // every status change in builder.py / outreach.py. Without this, a
  // rebuild after router.refresh() leaves the iframe element with the
  // identical src, so the browser keeps showing the stale (often 404'd)
  // response from the previous attempt. The /api/leadgen/file route
  // ignores query strings, so this is purely a client-side cache-bust.
  const fileVersion = encodeURIComponent(detail.updated_at);
  const fileUrl = (filename: string) =>
    `/api/leadgen/file/${encodeURIComponent(outDir)}/${encodeURIComponent(filename)}?v=${fileVersion}`;

  const analysis = detail.ai_analysis;
  const aiScore = analysis?.opportunity_score ?? detail.research?.opportunity_score ?? null;
  const websiteScore = detail.research?.website_score ?? null;
  const isParked =
    typeof analysis?.summary === "string" &&
    /\bparked\b/i.test(analysis.summary);

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      {/* ── Header / back link ──────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/dashboard/leadgen"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to prospecting
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{detail.name}</h1>
            {detail.category && (
              <p className="text-sm text-gray-500 mt-0.5">
                {detail.category.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold border tabular-nums ${aiScoreClass(aiScore)}`}
            >
              AI {aiScore != null ? `${aiScore}/10` : "—"}
            </span>
            <span
              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${STATUS_STYLES[detail.status]}`}
            >
              {STATUS_LABELS[detail.status]}
            </span>
            {isParked && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                Parked domain
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Pipeline actions ────────────────────────────────────── */}
      <Card>
        <SectionTitle>Pipeline actions</SectionTitle>
        <StageButtons businessId={detail.id} status={detail.status} />
      </Card>

      {/* ── Business facts ──────────────────────────────────────── */}
      <Card>
        <SectionTitle>Business</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {detail.address && (
            <Field icon={MapPinIcon} label="Address">{detail.address}</Field>
          )}
          {detail.phone && (
            <Field icon={PhoneIcon} label="Phone">
              <a className="text-blue-700 hover:underline" href={`tel:${detail.phone}`}>{detail.phone}</a>
            </Field>
          )}
          {detail.email && (
            <Field icon={EnvelopeIcon} label="Email">
              <a className="text-blue-700 hover:underline" href={`mailto:${detail.email}`}>{detail.email}</a>
            </Field>
          )}
          {detail.website && (
            <Field icon={GlobeAltIcon} label="Website">
              <a className="text-blue-700 hover:underline break-all" href={detail.website} target="_blank" rel="noopener">
                {detail.website}
              </a>
            </Field>
          )}
          {detail.rating != null && (
            <Field icon={StarIcon} label="Google rating">
              {detail.rating}★ · {detail.review_count ?? 0} reviews
            </Field>
          )}
          {websiteScore != null && (
            <Field label="Heuristic website score">
              {websiteScore}/10
            </Field>
          )}
        </div>
      </Card>

      {/* ── AI analysis ─────────────────────────────────────────── */}
      {analysis ? (
        <Card>
          <SectionTitle>AI analysis</SectionTitle>
          {analysis.summary && (
            <p className="text-sm text-gray-800 leading-relaxed">{analysis.summary}</p>
          )}
          {analysis.pain_points && analysis.pain_points.length > 0 && (
            <Subsection title="Pain points">
              <ul className="space-y-1.5 text-sm text-gray-700">
                {analysis.pain_points.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-400 select-none mt-0.5">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Subsection>
          )}
          {analysis.opportunities && analysis.opportunities.length > 0 && (
            <Subsection title="Opportunities">
              <ul className="space-y-1.5 text-sm text-gray-700">
                {analysis.opportunities.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-500 select-none mt-0.5">→</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </Subsection>
          )}
          {analysis.recommended_services && analysis.recommended_services.length > 0 && (
            <Subsection title="Recommended services">
              <div className="flex flex-wrap gap-1.5">
                {analysis.recommended_services.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Subsection>
          )}
        </Card>
      ) : (
        <Card>
          <SectionTitle>AI analysis</SectionTitle>
          <p className="text-sm text-gray-600">
            Not researched yet. Run the research stage to generate analysis.
          </p>
        </Card>
      )}

      {/* ── Proposal + mockup previews ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle inline>Proposal PDF</SectionTitle>
            {detail.proposal?.estimated_value != null && (
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {formatCurrency(detail.proposal.estimated_value)}
              </span>
            )}
          </div>
          {hasProposalFile ? (
            <iframe
              src={fileUrl("proposal.pdf")}
              className="w-full h-[600px] rounded border bg-gray-50"
              title={`Proposal for ${detail.name}`}
            />
          ) : (
            <EmptyPreview message="No proposal built yet." />
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3 gap-2">
            <SectionTitle inline>Website mockup</SectionTitle>
            {/* M2.9: live preview link. Distinct from the iframe — the
                iframe shows the raw mockup so the operator can review;
                the link points to the banner-injected hosted version
                the prospect would click in an outreach email. */}
            {detail.proposal?.preview_url && (
              <a
                href={detail.proposal.preview_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
              >
                Open live preview
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </a>
            )}
          </div>
          {hasMockupFile ? (
            <iframe
              src={fileUrl("mockup.html")}
              className="w-full h-[600px] rounded border bg-gray-50"
              title={`Mockup for ${detail.name}`}
              sandbox="allow-same-origin"
            />
          ) : (
            <EmptyPreview message="No mockup built yet." />
          )}
        </Card>
      </div>

      {/* ── Outreach drafts ─────────────────────────────────────── */}
      <Card>
        <SectionTitle>Outreach drafts</SectionTitle>
        {detail.outreach.length === 0 ? (
          <p className="text-sm text-gray-600">
            No outreach generated yet.
          </p>
        ) : (
          <div className="space-y-4">
            {(["email", "sms", "phone"] as const).map((channel) => {
              const item = detail.outreach.find((o) => o.channel === channel);
              if (!item) return null;
              return (
                <OutreachBlock
                  key={channel}
                  item={item}
                  businessId={detail.id}
                  recipientEmail={detail.email}
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────
//
// These are intentionally inline rather than reused from @/components/ui/*:
//   - @/components/ui/Card is a dark glassmorphism shell
//     (bg-white/5 backdrop-blur-lg) styled for the marketing pages.
//     The dashboard uses a light theme (bg-white, text-gray-900) — wrong
//     fit visually.
//   - @/components/ui/StatusBadge exports InvoiceStatusBadge with a
//     hardcoded invoice status enum, not the BusinessStatus enum used here.
// When we ship a generalized dashboard Card/Badge primitive, swap these
// for it in a single follow-up pass.

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-white p-4 sm:p-5 space-y-4">{children}</div>;
}

function SectionTitle({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  if (inline) {
    return <h2 className="text-base font-semibold text-gray-900">{children}</h2>;
  }
  return <h2 className="text-base font-semibold text-gray-900 mb-3">{children}</h2>;
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className="text-gray-800">{children}</div>
    </div>
  );
}

function EmptyPreview({ message }: { message: string }) {
  return (
    <div className="w-full h-[300px] rounded border bg-gray-50 flex items-center justify-center text-sm text-gray-500">
      {message}
    </div>
  );
}

function OutreachBlock({
  item,
  businessId,
  recipientEmail,
}: {
  item: OutreachRow;
  businessId: number;
  recipientEmail: string | null;
}) {
  const labels: Record<OutreachRow["channel"], string> = {
    email: "Email",
    sms: "SMS",
    phone: "Phone script",
  };
  const Icons: Record<OutreachRow["channel"], React.ComponentType<{ className?: string }>> = {
    email: EnvelopeIcon,
    sms: DevicePhoneMobileIcon,
    phone: PhoneArrowUpRightIcon,
  };
  const Icon = Icons[item.channel];
  const statusBadge =
    item.status === "sent"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : item.status === "failed"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  // M3a: send affordance per channel. Email goes through Resend with
  // the inline screenshot. SMS is gated on Twilio's still-in-review
  // sender — we show the status muted instead of a button until the
  // landline-filter path is real.
  const showSendButton = item.channel === "email" && item.status === "draft";
  const showSmsPending = item.channel === "sms" && item.status === "draft";

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">{labels[item.channel]}</span>
        </div>
        <div className="flex items-center gap-2">
          {showSendButton && (
            <SendEmailButton
              businessId={businessId}
              recipientEmail={recipientEmail}
            />
          )}
          {showSmsPending && (
            <span className="text-xs text-amber-700 italic">
              Twilio in review
            </span>
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusBadge}`}>
            {item.status}
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {item.subject && (
          <div className="text-sm">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject </span>
            <span className="text-gray-900">{item.subject}</span>
          </div>
        )}
        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{item.message}</pre>
      </div>
    </div>
  );
}
