"use server";

/**
 * Server actions that trigger the Python pipeline. Each action spawns
 * `python run.py <stage> --id <N>` as a child process and waits for it
 * to finish, then revalidates the path so the page re-renders with the
 * updated DB state.
 *
 * Blocking is fine for MVP — the per-business commands take 5-60s. If
 * we move to longer runs (e.g. --build with 50 businesses) we'll need
 * to switch to a job-queue model or streaming. Phase 2 deploy work.
 *
 * Path-traversal isn't a concern here because we never accept arbitrary
 * file paths from the user; the subprocess command is built from a
 * server-controlled string + a numeric business id.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/authz";
import { PIPELINE_ROOT, PYTHON_EXECUTABLE } from "@/lib/leadgen-paths";

const exec = promisify(execFile);

import type { Stage } from "./utils";
export type { Stage };

const STAGE_TIMEOUTS_MS: Record<Stage, number> = {
  research: 90_000,    // Claude call + website fetch
  build:    300_000,   // 2 Claude streams (proposal + mockup, up to 24K tokens)
  outreach: 180_000,   // 3 Claude calls (email + SMS + phone)
};

export interface ActionResult {
  ok: boolean;
  stage: Stage;
  businessId: number;
  message: string;
  stdout?: string;
  stderr?: string;
}

/**
 * Runs `python run.py <stage> --id <businessId>` and returns the result.
 * Throws on auth failure (caller should not catch).
 */
async function runStage(stage: Stage, businessId: number): Promise<ActionResult> {
  const guard = await requireOwner();
  if (!guard.ok) {
    return {
      ok: false,
      stage,
      businessId,
      message: "Unauthorized",
    };
  }
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, stage, businessId, message: "Invalid business id" };
  }

  const args = [path.join(PIPELINE_ROOT, "run.py"), stage, "--id", String(businessId)];

  try {
    const { stdout, stderr } = await exec(PYTHON_EXECUTABLE, args, {
      cwd: PIPELINE_ROOT,
      timeout: STAGE_TIMEOUTS_MS[stage],
      maxBuffer: 5 * 1024 * 1024, // 5MB — mockup HTML can be ~40KB but stdout includes progress lines
      env: process.env,
    });
    revalidatePath(`/dashboard/leadgen/${businessId}`);
    revalidatePath("/dashboard/leadgen");
    return {
      ok: true,
      stage,
      businessId,
      message: `${stage} completed`,
      stdout: stdout.slice(-2000),
      stderr: stderr ? stderr.slice(-1000) : undefined,
    };
  } catch (err) {
    // execFile rejects with { code, stdout, stderr, killed, signal, message }
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      signal?: string;
    };
    let message = `${stage} failed`;
    if (e.killed && e.signal === "SIGTERM") message = `${stage} timed out`;
    else if (e.code) message = `${stage} exited with code ${e.code}`;
    return {
      ok: false,
      stage,
      businessId,
      message,
      stdout: e.stdout?.slice(-2000),
      stderr: e.stderr?.slice(-1000),
    };
  }
}

export async function runResearch(businessId: number): Promise<ActionResult> {
  return runStage("research", businessId);
}

export async function runBuild(businessId: number): Promise<ActionResult> {
  return runStage("build", businessId);
}

export async function runOutreach(businessId: number): Promise<ActionResult> {
  return runStage("outreach", businessId);
}
