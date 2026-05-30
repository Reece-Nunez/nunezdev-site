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
  CityCount,
  ListFilters,
  AIAnalysis,
  ResearchRow,
  ProposalRow,
  OutreachRow,
} from "./leadgen-db";

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
 * Enqueue a prospect run for a zip code. Different shape from
 * triggerStageOnApi because prospect doesn't bind to a business —
 * it creates them.
 */
export async function triggerProspectOnApi(
  zip: string,
  maxPerCategory: number,
): Promise<JobRecord> {
  const qs = new URLSearchParams({ zip, max: String(maxPerCategory) });
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
