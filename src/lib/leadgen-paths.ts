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
