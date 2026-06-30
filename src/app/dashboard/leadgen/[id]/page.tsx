import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProspecting } from "@/lib/authz";
import {
  getBusiness,
  type BusinessStatus,
  type OutreachRow,
  type OutreachEvent,
  type OutreachEventType,
  type SmsConsentBasis,
} from "@/lib/leadgen-api";
import { businessOutputDirName } from "@/lib/leadgen-paths";
import { aiScoreClass, reasonLabel } from "../utils";
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
  PaperAirplaneIcon,
  CheckCircleIcon,
  EnvelopeOpenIcon,
  CursorArrowRaysIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  XCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import StageButtons from "../StageButtons";
import ConvertToLeadButton from "./ConvertToLeadButton";
import LogCallButton from "./LogCallButton";
import CallButton from "./CallButton";
import EditEmailField from "./EditEmailField";
import SendEmailButton from "./SendEmailButton";
import SmsSendButton from "./SmsSendButton";
import NotInterestedButton from "./NotInterestedButton";
import OutreachDraftBody from "./OutreachDraftBody";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_STYLES: Record<BusinessStatus, string> = {
  new:             "bg-blue-50 text-blue-700 border-blue-200",
  researched:      "bg-purple-50 text-purple-700 border-purple-200",
  proposal_built:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  contacted:       "bg-gray-100 text-gray-700 border-gray-200",
  replied:         "bg-orange-50 text-orange-700 border-orange-200",
  converted:       "bg-green-100 text-green-800 border-green-300",
  not_interested:  "bg-red-50 text-red-700 border-red-200",
};
const STATUS_LABELS: Record<BusinessStatus, string> = {
  new:             "New",
  researched:      "Researched",
  proposal_built:  "Proposal built",
  contacted:       "Contacted",
  replied:         "Replied",
  converted:       "Converted",
  not_interested:  "Not interested",
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

  // Reopening a declined lead should return it to where it was, not reset
  // to "new". Pull the from_status of the most recent → not_interested
  // transition (events are newest-first); fall back to "new" for legacy
  // rows that predate the audit log.
  const lastDecline = detail.status_events.find(
    (e) => e.to_status === "not_interested",
  );
  const priorStatus = lastDecline?.from_status ?? "new";

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
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <CallButton businessId={detail.id} hasPhone={!!detail.phone} />
          <LogCallButton businessId={detail.id} />
          <ConvertToLeadButton
            businessId={detail.id}
            status={detail.status}
            hasEmail={!!detail.email}
          />
          <NotInterestedButton
            businessId={detail.id}
            status={detail.status}
            priorStatus={priorStatus}
          />
        </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <a className="text-blue-700 hover:underline" href={`tel:${detail.phone}`}>{detail.phone}</a>
                <SmsCapabilityBadge phoneType={detail.phone_type} smsCapable={detail.sms_capable} />
              </div>
            </Field>
          )}
          <Field icon={EnvelopeIcon} label="Email">
            <div className="flex flex-wrap items-center gap-2">
              <EditEmailField businessId={detail.id} email={detail.email} />
              <EmailSourceBadge source={detail.email_source} hasEmail={!!detail.email} />
            </div>
          </Field>
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
                  phone={detail.phone}
                  smsConsentBasis={detail.sms_consent?.basis ?? null}
                  smsOptedOut={detail.sms_opted_out}
                  screenshotUrl={
                    // Email inlines it; SMS attaches it as MMS media on text 1.
                    // Show it on both draft cards so the operator can confirm
                    // the mockup before sending. (phone script has no preview.)
                    channel === "email" || channel === "sms"
                      ? detail.proposal?.screenshot_url ?? null
                      : null
                  }
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Engagement timeline ─────────────────────────────────── */}
      {detail.outreach_events.length > 0 && (
        <Card>
          <SectionTitle>Engagement</SectionTitle>
          <ol className="space-y-3">
            {detail.outreach_events.map((e) => (
              <EngagementRow key={e.id} event={e} />
            ))}
          </ol>
        </Card>
      )}

      {/* ── Status history ──────────────────────────────────────── */}
      {detail.status_events.length > 0 && (
        <Card>
          <SectionTitle>Status history</SectionTitle>
          <ol className="space-y-3">
            {detail.status_events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLES[e.to_status]}`}
                >
                  {STATUS_LABELS[e.to_status]}
                </span>
                <div className="min-w-0">
                  <div className="text-gray-800">
                    {e.from_status ? (
                      <>
                        {STATUS_LABELS[e.from_status]} → {STATUS_LABELS[e.to_status]}
                      </>
                    ) : (
                      STATUS_LABELS[e.to_status]
                    )}
                    {e.reason && (
                      <span className="text-gray-500"> · {reasonLabel(e.reason)}</span>
                    )}
                  </div>
                  {e.note && <div className="text-gray-600 mt-0.5">{e.note}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(e.created_at).toLocaleString()} · {e.actor}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
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

const PILL = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border";

// Can this number receive an SMS? Drives the operator's decision to text vs
// call. Source: Twilio Lookup line type stored at prospect time (migration 014).
function SmsCapabilityBadge({
  phoneType,
  smsCapable,
}: {
  phoneType: string | null;
  smsCapable: boolean | null;
}) {
  if (smsCapable === true) {
    return (
      <span className={`${PILL} bg-green-100 text-green-800 border-green-300`}>
        {phoneType === "landline" ? "Textable" : `${phoneType ?? "Mobile"} · textable`}
      </span>
    );
  }
  if (smsCapable === false) {
    return (
      <span className={`${PILL} bg-gray-100 text-gray-600 border-gray-200`}>
        {phoneType ?? "Landline"} · no SMS
      </span>
    );
  }
  // null — never looked up, lookup failed, or an ambiguous line type.
  return (
    <span className={`${PILL} bg-amber-50 text-amber-700 border-amber-200`}>
      SMS capability unknown
    </span>
  );
}

// Where the email came from — or why none was found. Lets the operator trust a
// scraped address, know a Hunter hit cost a credit, or chase a missing one.
const EMAIL_SOURCE_META: Record<string, { label: string; cls: string }> = {
  scraped_home:    { label: "Found on site",      cls: "bg-green-100 text-green-800 border-green-300" },
  scraped_contact: { label: "Found on contact page", cls: "bg-green-100 text-green-800 border-green-300" },
  hunter_api:      { label: "Found via Hunter",   cls: "bg-blue-100 text-blue-800 border-blue-300" },
  no_website:      { label: "No website to scrape", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  blocked:         { label: "Site blocked our check", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  none_found:      { label: "No email found",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

function EmailSourceBadge({
  source,
  hasEmail,
}: {
  source: string | null;
  hasEmail: boolean;
}) {
  // A manually-entered email has no provenance label — say nothing rather
  // than mislabel it.
  if (!source) return null;
  if (hasEmail && source.startsWith("scraped")) return null; // self-evident; don't clutter
  const meta = EMAIL_SOURCE_META[source];
  if (!meta) return null;
  return <span className={`${PILL} ${meta.cls}`}>{meta.label}</span>;
}

// Per-event presentation for the engagement timeline. Positive signals
// (delivered/opened/clicked/replied) read warm; failures (bounced/complained/
// failed) read red. Mirrors OutreachEventType in leadgen-db.ts.
const EVENT_META: Record<
  OutreachEventType,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  sent:       { label: "Sent",        icon: PaperAirplaneIcon,       cls: "text-gray-400" },
  delivered:  { label: "Delivered",   icon: CheckCircleIcon,         cls: "text-blue-500" },
  opened:     { label: "Opened",      icon: EnvelopeOpenIcon,        cls: "text-emerald-500" },
  clicked:    { label: "Clicked",     icon: CursorArrowRaysIcon,     cls: "text-emerald-600" },
  bounced:    { label: "Bounced",     icon: ExclamationTriangleIcon, cls: "text-red-500" },
  complained: { label: "Spam report", icon: ExclamationTriangleIcon, cls: "text-red-600" },
  replied:    { label: "Replied",     icon: ChatBubbleLeftRightIcon, cls: "text-orange-600" },
  failed:     { label: "Failed",      icon: XCircleIcon,             cls: "text-red-500" },
  call:       { label: "Call",        icon: PhoneIcon,               cls: "text-gray-600" },
  claimed:    { label: "Claimed site", icon: SparklesIcon,           cls: "text-green-600" },
};

function EngagementRow({ event }: { event: OutreachEvent }) {
  const meta = EVENT_META[event.event_type];
  const Icon = meta.icon;
  // Prefer the provider's event time; fall back to when we recorded it.
  const when = event.occurred_at ?? event.created_at;
  return (
    <li className="flex gap-3 text-sm">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.cls}`} />
      <div className="min-w-0">
        <div className="text-gray-800">
          {meta.label}
          <span className="text-gray-400"> · {event.channel.toUpperCase()}</span>
        </div>
        {event.detail && (
          <div className="text-gray-600 mt-0.5 break-words">{event.detail}</div>
        )}
        <div className="text-xs text-gray-400 mt-0.5">
          {new Date(when).toLocaleString()}
        </div>
      </div>
    </li>
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
  phone,
  smsConsentBasis,
  smsOptedOut,
  screenshotUrl,
}: {
  item: OutreachRow;
  businessId: number;
  recipientEmail: string | null;
  phone: string | null;
  smsConsentBasis: SmsConsentBasis | null;
  smsOptedOut: boolean;
  screenshotUrl: string | null;
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

  // Send affordance per channel. Email goes through Resend with the inline
  // screenshot. SMS goes through Twilio behind the consent gate (see
  // SmsSendButton) — compliance guardrails are enforced server-side.
  const showSendButton = item.channel === "email" && item.status === "draft";
  const showSmsSend = item.channel === "sms" && item.status === "draft";

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50/80 border-b border-gray-200 gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-yellow/20 text-brand-black">
            <Icon className="w-4 h-4" />
          </span>
          <span className="text-sm font-semibold text-gray-900">{labels[item.channel]}</span>
        </div>
        <div className="flex items-center gap-2">
          {showSendButton && (
            <SendEmailButton
              businessId={businessId}
              recipientEmail={recipientEmail}
            />
          )}
          {showSmsSend && (
            <SmsSendButton
              businessId={businessId}
              phone={phone}
              consentBasis={smsConsentBasis}
              optedOut={smsOptedOut}
            />
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusBadge}`}>
            {item.status}
          </span>
        </div>
      </div>
      <div className="p-3.5">
        {/* Editable draft body — subject (email only), the inline screenshot
            preview, and the message. The operator can tweak the AI copy
            before sending; the API refuses edits once the draft is sent. */}
        <OutreachDraftBody
          businessId={businessId}
          channel={item.channel}
          subject={item.subject}
          message={item.message}
          screenshotUrl={screenshotUrl}
          editable={item.status !== "sent"}
        />
      </div>
    </div>
  );
}
