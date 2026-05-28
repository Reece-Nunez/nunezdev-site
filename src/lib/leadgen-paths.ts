/**
 * Server-side path resolution for the automated-ai-pipeline (Python project
 * living in a sibling directory, currently C:\Users\reece\Documents\NunezDev\
 * automated-ai-pipeline\). The UI reads its SQLite DB and serves files from
 * its output directory; for Phase 2 these will become HTTP calls to a
 * deployed pipeline API.
 *
 * Configure via .env.local:
 *   LEADGEN_PIPELINE_ROOT  absolute path to the pipeline repo
 *   LEADGEN_DB_PATH        absolute path to leads.db (defaults to <root>/leads.db)
 *   LEADGEN_OUTPUT_DIR     absolute path to output/   (defaults to <root>/output)
 *   LEADGEN_PYTHON         python executable name     (defaults to "python")
 *
 * The defaults assume the pipeline sits next to nunezdev-site under NunezDev/.
 */
import path from "node:path";

const DEFAULT_ROOT =
  process.env.LEADGEN_PIPELINE_ROOT ||
  // Default: ../automated-ai-pipeline relative to this Next.js project root.
  // process.cwd() during a Next.js build/start is the project root.
  path.resolve(process.cwd(), "..", "automated-ai-pipeline");

export const PIPELINE_ROOT = DEFAULT_ROOT;

export const LEADGEN_DB_PATH =
  process.env.LEADGEN_DB_PATH || path.join(PIPELINE_ROOT, "leads.db");

export const LEADGEN_OUTPUT_DIR =
  process.env.LEADGEN_OUTPUT_DIR || path.join(PIPELINE_ROOT, "output");

export const PYTHON_EXECUTABLE = process.env.LEADGEN_PYTHON || "python";

/**
 * Mirror of `business_output_dir()` in the pipeline's builder.py. Generates
 * the per-business folder name where the pipeline writes proposal.pdf and
 * mockup.html. The two implementations MUST stay aligned — if the Python
 * sanitizer changes (different unsafe-char set, different empty-fallback
 * rule), this needs to change in lockstep or the UI won't find the files.
 *
 * Replicated rules:
 *   - Keep [A-Za-z0-9 \-], replace anything else with '_'.
 *   - Strip surrounding whitespace and trailing dots (Windows-illegal).
 *   - If the result is empty / all underscores, fall back to 'unnamed'.
 *   - Always suffix with `_<business_id>` for collision-free uniqueness.
 */
export function businessOutputDirName(businessId: number, businessName: string): string {
  let safe = "";
  for (const c of businessName) {
    if (/[A-Za-z0-9 \-]/.test(c)) safe += c;
    else safe += "_";
  }
  safe = safe.trim().replace(/\.+$/, "");
  if (!safe.replace(/_/g, "")) safe = "unnamed";
  return `${safe}_${businessId}`;
}
