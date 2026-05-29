/**
 * Read-only access to the automated-ai-pipeline SQLite DB (leads.db).
 *
 * better-sqlite3 is synchronous (perfect for server components — no
 * await ceremony, no connection pool) and zero-config. The DB is opened
 * in readonly mode because writes belong to the Python pipeline; the UI
 * triggers Python subprocesses for state changes.
 *
 * The schema we read from lives in the pipeline's db.py. Keep the
 * TypeScript types here in sync with that file — if a column is
 * added there it won't show up automatically here.
 */
import Database from "better-sqlite3";
import { LEADGEN_DB_PATH } from "./leadgen-paths";

// ── Schema-shaped types ───────────────────────────────────────────

export type BusinessStatus =
  | "new"
  | "researched"
  | "proposal_built"
  | "contacted";

// Pipeline stage identifiers — mirror api.jobs.VALID_STAGES on the
// pipeline side. Keep in sync with the CHECK constraint on
// leadgen.jobs.stage and api/jobs.py::_STAGE_DISPATCH.
export type Stage = "research" | "build" | "outreach";

export interface BusinessRow {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  category: string | null;
  place_id: string | null;
  rating: number | null;
  review_count: number | null;
  status: BusinessStatus;
  opportunity_score: number;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchRow {
  id: number;
  business_id: number;
  has_website: number; // 0 or 1
  website_score: number | null;
  social_presence: string | null;
  opportunities: string | null; // JSON
  ai_analysis: string | null; // JSON
  opportunity_score: number | null;
  created_at: string;
}

export interface AIAnalysis {
  opportunity_score?: number;
  summary?: string;
  pain_points?: string[];
  opportunities?: string[];
  recommended_services?: string[];
}

export interface ProposalRow {
  id: number;
  business_id: number;
  services: string | null; // JSON
  proposal_text: string | null;
  mockup_html: string | null;
  estimated_value: number | null;
  created_at: string;
}

export interface OutreachRow {
  id: number;
  business_id: number;
  channel: "email" | "sms" | "phone";
  subject: string | null;
  message: string | null;
  status: "draft" | "sent" | "failed";
  sent_at: string | null;
  created_at: string;
}

// ── Joined view types for the UI ──────────────────────────────────

export interface BusinessSummary extends BusinessRow {
  ai_score: number | null;
  website_score: number | null;
}

export interface BusinessDetail extends BusinessRow {
  research: ResearchRow | null;
  ai_analysis: AIAnalysis | null;
  proposal: ProposalRow | null;
  outreach: OutreachRow[];
}

// ── Connection ────────────────────────────────────────────────────

// We open the DB lazily and cache the handle for the lifetime of the
// Node process. better-sqlite3 connections are cheap but caching is
// nicer for cold-start latency on every dashboard navigation.
let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(LEADGEN_DB_PATH, { readonly: true, fileMustExist: false });
  // Improves read latency under WAL mode (pipeline writes use WAL too).
  try {
    _db.pragma("journal_mode = WAL");
  } catch {
    // pragma may fail in pure-readonly mode; harmless.
  }
  return _db;
}

/** True if the DB file exists and is readable — useful for empty-state UI. */
export function isAvailable(): boolean {
  try {
    db().prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

// ── Read APIs ─────────────────────────────────────────────────────

/**
 * Top-level dashboard stats. Mirrors `python run.py stats` so the UI
 * shows the same numbers the operator sees in the CLI.
 */
export interface DashboardStats {
  total: number;
  by_status: Record<BusinessStatus, number>;
  avg_ai_score: number | null;
  total_pipeline_value: number;
}

export function getStats(): DashboardStats {
  const total = (db().prepare("SELECT COUNT(*) AS c FROM businesses").get() as { c: number }).c;

  const statusRows = db()
    .prepare("SELECT status, COUNT(*) AS c FROM businesses GROUP BY status")
    .all() as { status: BusinessStatus; c: number }[];
  const by_status: Record<BusinessStatus, number> = {
    new: 0,
    researched: 0,
    proposal_built: 0,
    contacted: 0,
  };
  for (const r of statusRows) by_status[r.status] = r.c;

  const avg =
    (db()
      .prepare(
        "SELECT ROUND(AVG(opportunity_score), 1) AS s FROM research WHERE opportunity_score IS NOT NULL"
      )
      .get() as { s: number | null }).s ?? null;

  const value =
    (db()
      .prepare("SELECT COALESCE(SUM(estimated_value), 0) AS v FROM proposals")
      .get() as { v: number }).v;

  return {
    total,
    by_status,
    avg_ai_score: avg,
    total_pipeline_value: value,
  };
}

/**
 * List businesses for the index table. Joined with research so the UI
 * can sort by the AI-driven opportunity_score (which is more accurate
 * than the heuristic prospect score on businesses.opportunity_score).
 */
export interface ListFilters {
  status?: BusinessStatus | "all";
  minScore?: number;
  limit?: number;
  category?: string;
}

export function listBusinesses(filters: ListFilters = {}): BusinessSummary[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.status && filters.status !== "all") {
    where.push("b.status = @status");
    params.status = filters.status;
  }
  if (typeof filters.minScore === "number") {
    where.push("COALESCE(r.opportunity_score, 0) >= @minScore");
    params.minScore = filters.minScore;
  }
  if (filters.category) {
    where.push("b.category = @category");
    params.category = filters.category;
  }
  const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
  // LIMIT is interpolated as a literal (named params on LIMIT aren't
  // supported in older sqlite). Clamp + Number.isFinite is defensive
  // against NaN/Infinity bleed-through from callers — a raw NaN would
  // produce a SQL error.
  const rawLimit = filters.limit ?? 200;
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, rawLimit)) : 200;

  // Use a window function to pick the latest research row per business —
  // the schema allows multiple rows per business_id (re-running research
  // inserts another row). A plain LEFT JOIN would multiply the result
  // set, so the same business would appear twice in the dashboard table.
  return db()
    .prepare(
      `SELECT b.*,
              r.opportunity_score AS ai_score,
              r.website_score    AS website_score
         FROM businesses b
         LEFT JOIN (
           SELECT business_id, opportunity_score, website_score,
                  ROW_NUMBER() OVER (
                    PARTITION BY business_id
                    ORDER BY created_at DESC, id DESC
                  ) AS rn
             FROM research
         ) r ON r.business_id = b.id AND r.rn = 1
         ${whereClause}
         ORDER BY r.opportunity_score DESC NULLS LAST,
                  b.review_count ASC
         LIMIT ${limit}`
    )
    .all(params) as BusinessSummary[];
}

/** Distinct categories present in the DB, for filter dropdowns. */
export function listCategories(): string[] {
  return (
    db()
      .prepare("SELECT DISTINCT category FROM businesses WHERE category IS NOT NULL ORDER BY category")
      .all() as { category: string }[]
  ).map((r) => r.category);
}

/** Full detail for one business. Returns null if not found. */
export function getBusiness(id: number): BusinessDetail | null {
  const business = db().prepare("SELECT * FROM businesses WHERE id = ?").get(id) as
    | BusinessRow
    | undefined;
  if (!business) return null;

  // research and proposals have no UNIQUE constraint on business_id in the
  // pipeline schema — re-running a stage inserts a new row. Without an
  // explicit ORDER BY, .get() returns whichever row SQLite scans first
  // (unspecified order). Always grab the most recent so the UI reflects
  // the latest run.
  const research = db()
    .prepare("SELECT * FROM research WHERE business_id = ? ORDER BY created_at DESC, id DESC LIMIT 1")
    .get(id) as ResearchRow | undefined;

  let ai_analysis: AIAnalysis | null = null;
  if (research?.ai_analysis) {
    try {
      ai_analysis = JSON.parse(research.ai_analysis) as AIAnalysis;
    } catch {
      ai_analysis = null;
    }
  }

  const proposal = db()
    .prepare("SELECT * FROM proposals WHERE business_id = ? ORDER BY created_at DESC, id DESC LIMIT 1")
    .get(id) as ProposalRow | undefined;

  const outreach = db()
    .prepare("SELECT * FROM outreach WHERE business_id = ? ORDER BY channel")
    .all(id) as OutreachRow[];

  return {
    ...business,
    research: research ?? null,
    ai_analysis,
    proposal: proposal ?? null,
    outreach,
  };
}
