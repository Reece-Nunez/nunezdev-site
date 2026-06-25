/**
 * Dispatcher between two implementations of the leadgen data layer:
 *
 *   - Direct SQLite via leadgen-db.ts (local-dev default — Next.js
 *     reads the pipeline's leads.db file on disk)
 *   - HTTP to the FastAPI service in automated-ai-pipeline/api/ when
 *     LEADGEN_API_URL is set (the path we'll use in production once
 *     the pipeline lives on Fly.io)
 *
 * The dashboard pages always import from THIS module — they don't
 * care which backend is in play. Switching backends is a single env
 * var, not a code change.
 *
 * Auth: bearer token in LEADGEN_API_TOKEN. Never sent to the browser —
 * the file-serving route in src/app/api/leadgen/file/[...path]/route.ts
 * proxies the call server-side so the token stays on the host.
 */
import "server-only";

import {
  isAvailable as dbIsAvailable,
  getStats as dbGetStats,
  listBusinesses as dbListBusinesses,
  listCategories as dbListCategories,
  listCities as dbListCities,
  getBusiness as dbGetBusiness,
  type DashboardStats,
  type BusinessSummary,
  type BusinessDetail,
  type CityCount,
  type ListFilters,
} from "./leadgen-db";

export type {
  DashboardStats,
  BusinessSummary,
  BusinessDetail,
  BusinessStatus,
  StatusReason,
  StatusEvent,
  SmsConsentBasis,
  SmsConsentInfo,
  CityCount,
  ListFilters,
  AIAnalysis,
  ResearchRow,
  ProposalRow,
  OutreachRow,
  OutreachEvent,
  OutreachEventType,
} from "./leadgen-db";

import type { BusinessStatus, StatusReason, SmsConsentBasis } from "./leadgen-db";

const API_URL = process.env.LEADGEN_API_URL?.replace(/\/+$/, "") || "";
const API_TOKEN = process.env.LEADGEN_API_TOKEN || "";

/** True when the dispatcher should use the HTTP backend. */
export function isRemoteBackend(): boolean {
  return API_URL.length > 0;
}

class LeadgenApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "LeadgenApiError";
  }
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!API_URL) {
    throw new LeadgenApiError(500, "LEADGEN_API_URL not configured");
  }
  if (!API_TOKEN) {
    // Mirrors the fail-closed behavior on the FastAPI side. Better to
    // explode loudly here than to make a request that'll 401.
    throw new LeadgenApiError(500, "LEADGEN_API_TOKEN not configured");
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
      ...(init.headers || {}),
    },
    // Server-side fetches default to caching in Next.js 15. For dashboard
    // data we always want fresh reads — the operator just kicked off a
    // pipeline stage and expects to see the result.
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LeadgenApiError(
      res.status,
      `${path} → ${res.status}: ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

// ── Public surface ───────────────────────────────────────────────
// Function signatures intentionally mirror leadgen-db.ts so swapping
// backends is invisible to callers.

export async function isAvailable(): Promise<boolean> {
  if (!isRemoteBackend()) return dbIsAvailable();
  try {
    const r = await fetch(`${API_URL}/healthz`, { cache: "no-store" });
    if (!r.ok) return false;
    const body = (await r.json()) as { ok?: boolean; db?: boolean };
    return body.ok === true && body.db === true;
  } catch {
    return false;
  }
}

export async function getStats(): Promise<DashboardStats> {
  if (!isRemoteBackend()) return dbGetStats();
  return apiFetch<DashboardStats>("/stats");
}

export async function listBusinesses(
  filters: ListFilters = {},
): Promise<BusinessSummary[]> {
  if (!isRemoteBackend()) return dbListBusinesses(filters);
  const qs = new URLSearchParams();
  if (filters.status && filters.status !== "all") qs.set("status", filters.status);
  if (typeof filters.minScore === "number") qs.set("min_score", String(filters.minScore));
  if (filters.category) qs.set("category", filters.category);
  if (filters.city) qs.set("city", filters.city);
  if (typeof filters.limit === "number") qs.set("limit", String(filters.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<BusinessSummary[]>(`/businesses${suffix}`);
}

/** Distinct (city, state, count) rows for the dashboard chip filter. */
export async function listCities(): Promise<CityCount[]> {
  if (!isRemoteBackend()) return dbListCities();
  return apiFetch<CityCount[]>("/cities");
}

export async function listCategories(): Promise<string[]> {
  // The API doesn't expose a categories endpoint yet — derive from the
  // listing instead. Cheap enough at the current scale (a few hundred
  // businesses); revisit if the catalog grows.
  if (!isRemoteBackend()) return dbListCategories();
  const rows = await listBusinesses({ limit: 500 });
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.category) seen.add(r.category);
  }
  return [...seen].sort();
}

export async function getBusiness(id: number): Promise<BusinessDetail | null> {
  if (!isRemoteBackend()) return dbGetBusiness(id);
  try {
    return await apiFetch<BusinessDetail>(`/businesses/${id}`);
  } catch (err) {
    if (err instanceof LeadgenApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Stage triggers + job polling (Phase 2 M2) ────────────────────
//
// These ALWAYS go through the HTTP API — there's no local-execFile
// fallback. The pipeline lives behind the API now; if LEADGEN_API_URL
// isn't configured, the caller gets a loud error rather than a silent
// fallback that wouldn't work in production anyway.

import type { Stage } from "./leadgen-db";
export type { Stage };

export type JobStatusValue = "queued" | "running" | "completed" | "failed";

/** Shape returned by POST /stages/{stage}/{id} and GET /jobs/{id}. */
export interface JobRecord {
  id: string;
  stage: Stage;
  business_id: number;
  status: JobStatusValue;
  error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/**
 * Enqueue a pipeline stage and return the new job record immediately.
 * Throws if the API is unreachable or returns a non-2xx.
 */
export async function triggerStageOnApi(
  stage: Stage,
  businessId: number,
): Promise<JobRecord> {
  return apiFetch<JobRecord>(`/stages/${stage}/${businessId}`, {
    method: "POST",
  });
}

/**
 * Options for a prospect run. `zip` is always the search center. With no
 * `query` it's the 20-category sweep (`max` = per-category cap). With a
 * `query` it's a single free-text Places search (keyword or business name),
 * and the radius/rating/website filters apply.
 */
export interface ProspectOptions {
  zip: string;
  max?: number;
  query?: string;
  radiusMiles?: number;
  minRating?: number;
  maxRating?: number;
  onlyNoWebsite?: boolean;
}

/**
 * Enqueue a prospect run. Different shape from triggerStageOnApi because
 * prospect doesn't bind to a business — it creates them.
 */
export async function triggerProspectOnApi(opts: ProspectOptions): Promise<JobRecord> {
  const qs = new URLSearchParams({ zip: opts.zip });
  if (opts.max != null) qs.set("max", String(opts.max));
  if (opts.query) qs.set("query", opts.query);
  if (opts.radiusMiles != null) qs.set("radius_miles", String(opts.radiusMiles));
  if (opts.minRating != null) qs.set("min_rating", String(opts.minRating));
  if (opts.maxRating != null) qs.set("max_rating", String(opts.maxRating));
  if (opts.onlyNoWebsite) qs.set("only_no_website", "true");
  return apiFetch<JobRecord>(`/stages/prospect?${qs}`, { method: "POST" });
}

/**
 * Read a single job by id. Returns null when the job is not found
 * (the API responds 404); throws on other transport errors.
 */
export async function getJobFromApi(jobId: string): Promise<JobRecord | null> {
  try {
    return await apiFetch<JobRecord>(`/jobs/${encodeURIComponent(jobId)}`);
  } catch (err) {
    if (err instanceof LeadgenApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Operator profile (Phase 2 M2.7) ──────────────────────────────

/** Shape of GET / PUT /operator-profile. */
export interface OperatorProfile {
  name: string;
  company: string;
  email: string;
  phone: string;
  calendar_url: string;
  signoff_notes: string;
  updated_at: string | null;
}

/** Empty profile shape — used as the form's initial state on a fresh deploy. */
export const EMPTY_OPERATOR_PROFILE: OperatorProfile = {
  name: "",
  company: "",
  email: "",
  phone: "",
  calendar_url: "",
  signoff_notes: "",
  updated_at: null,
};

export async function getOperatorProfile(): Promise<OperatorProfile> {
  if (!isRemoteBackend()) {
    // Local-dev hasn't wired the local DB read for the profile yet —
    // surfacing an empty profile here keeps the settings page usable
    // against a local-only Postgres without needing a fallback path.
    return EMPTY_OPERATOR_PROFILE;
  }
  return apiFetch<OperatorProfile>(`/operator-profile`);
}

// ── Outreach send (Phase 2 M3a) ──────────────────────────────────

export interface OutreachSendResult {
  ok: boolean;
  message_id: string | null;
  sent_at: string | null;
}

/**
 * Send the existing email draft for a business via the pipeline's
 * Resend integration. The pipeline does all the work (fetch screenshot
 * from S3, build multipart email with inline image, send, update DB) —
 * this just relays the trigger and surfaces the result.
 *
 * Throws on any 4xx/5xx so the caller can surface a real error message
 * in a toast. 4xx errors include human-readable text; 5xx is "server
 * logs have the details".
 */
export async function sendOutreachEmail(businessId: number): Promise<OutreachSendResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Send requires LEADGEN_API_URL — the local-dev backend is read-only.",
    );
  }
  return apiFetch<OutreachSendResult>(
    `/outreach/${businessId}/send-email`,
    { method: "POST" },
  );
}

export interface SmsSendResult {
  ok: boolean;
  message_id: string | null;
  sent_at: string | null;
}

/**
 * Send the SMS draft via Twilio — compliance-gated server-side (consent,
 * opt-out, quiet hours, sender ID + STOP). Throws on a non-2xx; the message
 * carries the human-readable reason (e.g. "no SMS consent on file").
 */
export async function sendSmsOutreach(businessId: number): Promise<SmsSendResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Sending SMS requires LEADGEN_API_URL — the local-dev backend is read-only.",
    );
  }
  return apiFetch<SmsSendResult>(`/outreach/${businessId}/send-sms`, { method: "POST" });
}

export interface SmsConsentResult {
  business_id: number;
  basis: SmsConsentBasis;
  consented_at: string;
}

/** Record (or update) the SMS consent basis for a business — required before
 * the lead can be texted. */
export async function recordSmsConsent(
  businessId: number,
  basis: SmsConsentBasis,
  note?: string | null,
): Promise<SmsConsentResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Recording consent requires LEADGEN_API_URL — the local-dev backend is read-only.",
    );
  }
  return apiFetch<SmsConsentResult>(`/businesses/${businessId}/sms-consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ basis, note: note ?? null }),
  });
}

export interface OutreachDraftResult {
  business_id: number;
  channel: "email" | "sms" | "phone";
  subject: string | null;
  message: string | null;
  status: string;
}

/**
 * Edit a generated outreach draft (subject/message) before it's sent.
 * `subject` only applies to the email channel. Throws on a non-2xx
 * (400 empty/invalid, 404 no draft, 409 already sent).
 */
export async function updateOutreachDraft(
  businessId: number,
  channel: "email" | "sms" | "phone",
  patch: { message: string; subject?: string | null },
): Promise<OutreachDraftResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Editing drafts requires LEADGEN_API_URL — the local-dev backend is read-only.",
    );
  }
  return apiFetch<OutreachDraftResult>(`/outreach/${businessId}/${channel}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: patch.message, subject: patch.subject ?? null }),
  });
}

export interface SetEmailResult {
  business_id: number;
  email: string;
}

/**
 * Set (or correct) a business's contact email — used when prospecting found
 * no email but the operator located one by hand. Persists it on the business
 * row (so it's on file going forward), then the normal send path uses it.
 * Throws on a non-2xx (400 invalid address, 404 unknown business).
 */
export async function setBusinessEmail(
  businessId: number,
  email: string,
): Promise<SetEmailResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Editing email requires LEADGEN_API_URL — the local-dev backend is read-only.",
    );
  }
  return apiFetch<SetEmailResult>(`/businesses/${businessId}/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

// ── Lead status transitions (Phase 2 M4) ─────────────────────────

export interface SetStatusInput {
  status: BusinessStatus;
  /** Required by the API when status is "not_interested". */
  reason?: StatusReason | null;
  note?: string | null;
  /** Who made the change — the server action passes the operator's email. */
  actor?: string | null;
}

export interface SetStatusResult {
  business_id: number;
  from_status: BusinessStatus | null;
  to_status: BusinessStatus;
  /** false when the business was already at the requested status (no-op). */
  changed: boolean;
}

/**
 * Set a business's lifecycle status and log it to the status_events audit
 * trail. The primary use is marking a lead "not_interested" with a reason +
 * note, and reopening it later. Throws LeadgenApiError on a non-2xx — the
 * API returns 400 for invalid/missing reason, 404 for unknown business.
 */
export async function setBusinessStatus(
  businessId: number,
  input: SetStatusInput,
): Promise<SetStatusResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Status changes require LEADGEN_API_URL — the local-dev backend is read-only.",
    );
  }
  return apiFetch<SetStatusResult>(`/businesses/${businessId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: input.status,
      reason: input.reason ?? null,
      note: input.note ?? null,
      actor: input.actor ?? null,
    }),
  });
}


// ── Inbound reply logging (Phase 2 M6 — Gmail poller) ────────────

export interface RecordReplyResult {
  business_id: number;
  /** false when the reply was already logged (deduped on a re-poll). */
  recorded: boolean;
  status: BusinessStatus;
}

/**
 * Record an inbound reply against a business (used by the Gmail reply-sync
 * cron). Idempotent server-side — re-polling the same message is a no-op that
 * returns recorded:false. Throws on a non-2xx (400 invalid channel, 404
 * unknown business).
 */
export async function recordReply(
  businessId: number,
  input: {
    channel: "email" | "sms";
    provider: string;
    providerMessageId?: string | null;
    snippet?: string | null;
    actor?: string | null;
  },
): Promise<RecordReplyResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Recording replies requires LEADGEN_API_URL — the local-dev backend is read-only.",
    );
  }
  return apiFetch<RecordReplyResult>(`/businesses/${businessId}/record-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: input.channel,
      provider: input.provider,
      provider_message_id: input.providerMessageId ?? null,
      snippet: input.snippet ?? null,
      actor: input.actor ?? null,
    }),
  });
}


// ── Analytics + integration health (Phase 2 M10) ─────────────────

export interface AnalyticsResult {
  by_status: Record<BusinessStatus, number>;
  total_businesses: number;
  pipeline_value: number;
  emails_sent: number;
  emails_delivered: number;
  emails_opened: number;
  emails_bounced: number;
  replies: number;
  calls_logged: number;
  reach: number;
  reply_rate: number | null;
  convert_rate: number | null;
  open_rate: number | null;
  follow_ups_due: number;
}

export async function getAnalytics(): Promise<AnalyticsResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Analytics requires LEADGEN_API_URL.");
  }
  return apiFetch<AnalyticsResult>("/analytics");
}

export interface IntegrationsHealth {
  database: boolean;
  anthropic: boolean;
  google_places: boolean;
  resend: boolean;
  resend_webhook: boolean;
  twilio: boolean;
  storage_s3: boolean;
  public_base_url: boolean;
}

export async function getIntegrationsHealth(): Promise<IntegrationsHealth> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Health check requires LEADGEN_API_URL.");
  }
  return apiFetch<IntegrationsHealth>("/health/integrations");
}


// ── Click-to-call (voice bridge, M9c) ────────────────────────────

export interface ClickToCallResult {
  ok: boolean;
  call_sid: string | null;
  ring: string | null;   // the operator number Twilio is ringing
}

/** Bridge a call: Twilio rings the operator, then dials the prospect. */
export async function clickToCallOnApi(businessId: number): Promise<ClickToCallResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Calling requires LEADGEN_API_URL.");
  }
  return apiFetch<ClickToCallResult>(`/calls/${businessId}/click-to-call`, { method: "POST" });
}


// ── Phone-call logging (Phase 2 M9) ──────────────────────────────
//
// CALL_OUTCOMES lives in ./leadgen/utils (NOT here) because the client
// component LogCallButton needs it, and this module is `server-only`.

export interface LogCallResult {
  business_id: number;
  status: BusinessStatus;
}

/** Log a phone-call outcome. 'interested' warms the lead to 'replied'. */
export async function logCallOnApi(
  businessId: number,
  outcome: string,
  note?: string | null,
): Promise<LogCallResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Logging a call requires LEADGEN_API_URL.");
  }
  return apiFetch<LogCallResult>(`/businesses/${businessId}/log-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome, note: note ?? null }),
  });
}


// ── Follow-up cadence (Phase 2 M7) ───────────────────────────────

export interface FollowUpRow {
  id: number;
  business_id: number;
  business_name: string;
  business_email: string | null;
  business_status: BusinessStatus;
  channel: "email" | "sms";
  step_number: number;
  status: "due" | "snoozed" | "sent" | "skipped" | "canceled";
  subject: string | null;
  message: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface FollowUpScanResult {
  scanned: number;
  drafted: number;
  canceled: number;
  promoted: number;
}

export interface FollowUpActionResult {
  id: number;
  status: string;
  sent_at: string | null;
}

/**
 * List follow-ups (default: the 'due' queue). Returns [] on the local SQLite
 * backend, which has no follow_ups table — keeps the dashboard renderable
 * locally without a remote pipeline.
 */
export async function listFollowUps(
  status: string = "due",
  limit = 200,
): Promise<FollowUpRow[]> {
  if (!isRemoteBackend()) return [];
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  qs.set("limit", String(limit));
  return apiFetch<FollowUpRow[]>(`/follow-ups?${qs}`);
}

/** Run the cadence scan (drafts newly-due follow-ups). Called by the cron. */
export async function scanFollowUps(): Promise<FollowUpScanResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Follow-up scan requires LEADGEN_API_URL.");
  }
  return apiFetch<FollowUpScanResult>(`/follow-ups/scan`, { method: "POST" });
}

export async function sendFollowUpOnApi(id: number): Promise<FollowUpActionResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Sending requires LEADGEN_API_URL — local-dev is read-only.");
  }
  return apiFetch<FollowUpActionResult>(`/follow-ups/${id}/send`, { method: "POST" });
}

export async function skipFollowUpOnApi(id: number): Promise<FollowUpActionResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Skipping requires LEADGEN_API_URL — local-dev is read-only.");
  }
  return apiFetch<FollowUpActionResult>(`/follow-ups/${id}/skip`, { method: "POST" });
}

export async function snoozeFollowUpOnApi(
  id: number,
  days: number,
): Promise<FollowUpActionResult> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(500, "Snoozing requires LEADGEN_API_URL — local-dev is read-only.");
  }
  return apiFetch<FollowUpActionResult>(`/follow-ups/${id}/snooze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });
}


export async function updateOperatorProfile(
  profile: OperatorProfile,
): Promise<OperatorProfile> {
  if (!isRemoteBackend()) {
    throw new LeadgenApiError(
      500,
      "Profile editing requires LEADGEN_API_URL — the local-dev fallback is read-only.",
    );
  }
  return apiFetch<OperatorProfile>(`/operator-profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

/**
 * Proxy a file request from the dashboard's /api/leadgen/file route to
 * the upstream API. Returns a streaming Response with the same status,
 * content-type, and body. Returns null when the local backend is in use
 * (caller should fall back to reading disk directly).
 */
export async function proxyFile(segments: string[]): Promise<Response | null> {
  if (!isRemoteBackend()) return null;
  if (!API_TOKEN) {
    return new Response(JSON.stringify({ error: "LEADGEN_API_TOKEN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const path = segments.map(encodeURIComponent).join("/");
  const upstream = await fetch(`${API_URL}/files/${path}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    cache: "no-store",
  });
  // Pass through the streaming body. Limit headers to the few we know
  // are safe to forward — avoids accidentally proxying Set-Cookie or
  // server-internal headers.
  const passHeaders = new Headers();
  for (const k of ["content-type", "content-length", "content-disposition", "cache-control"]) {
    const v = upstream.headers.get(k);
    if (v) passHeaders.set(k, v);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: passHeaders,
  });
}
