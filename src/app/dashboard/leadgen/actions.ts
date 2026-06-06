"use server";

/**
 * Server actions for triggering pipeline stages and polling their
 * progress.
 *
 * Phase 2 M2 rewrite: the dashboard no longer spawns ``python run.py``
 * locally. Every trigger goes through the FastAPI service deployed on
 * Fly. ``triggerStage`` returns immediately with a ``jobId`` — the
 * client polls ``pollJob(jobId)`` until the job reaches a terminal
 * status, then revalidates the page so the new research / proposal /
 * outreach rows appear.
 *
 * This file is a thin wrapper: all transport lives in leadgen-api.ts.
 * Keeping the wrapper means client components can call us as a server
 * action (no bearer-token exposure to the browser) while we keep the
 * fetch/auth concerns out of UI code.
 */
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/authz";
import {
  triggerStageOnApi,
  triggerProspectOnApi,
  getJobFromApi,
  updateOperatorProfile,
  sendOutreachEmail,
  sendSmsOutreach as sendSmsOutreachOnApi,
  recordSmsConsent as recordSmsConsentOnApi,
  updateOutreachDraft as updateOutreachDraftOnApi,
  setBusinessEmail as setBusinessEmailOnApi,
  setBusinessStatus as setBusinessStatusOnApi,
  type JobRecord,
  type OperatorProfile,
  type Stage,
  type BusinessStatus,
  type StatusReason,
  type SmsConsentBasis,
} from "@/lib/leadgen-api";

export type { Stage };

export interface TriggerResult {
  ok: boolean;
  /** Set when ok=true — pass this to pollJob to track progress. */
  jobId?: string;
  status?: JobRecord["status"];
  /** Human-readable label; appears in toast.error on failure. */
  message: string;
}

/**
 * Plain object form of JobRecord — keeps the server-action wire
 * format flat (no Date instances) so React Server Components can hand
 * it straight to the client.
 */
export interface JobStatus {
  id: string;
  stage: Stage;
  businessId: number;
  status: JobRecord["status"];
  error: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function _toJobStatus(j: JobRecord): JobStatus {
  return {
    id: j.id,
    stage: j.stage,
    businessId: j.business_id,
    status: j.status,
    error: j.error,
    result: j.result,
    createdAt: j.created_at,
    startedAt: j.started_at,
    finishedAt: j.finished_at,
  };
}

/**
 * Enqueue a pipeline stage. Returns ``{ok: true, jobId}`` immediately.
 * Caller should start polling ``pollJob`` and toast on the terminal
 * status.
 */
export async function triggerStage(
  stage: Stage,
  businessId: number,
): Promise<TriggerResult> {
  const guard = await requireOwner();
  if (!guard.ok) return { ok: false, message: "Unauthorized" };
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, message: "Invalid business id" };
  }
  try {
    const job = await triggerStageOnApi(stage, businessId);
    return {
      ok: true,
      jobId: job.id,
      status: job.status,
      message: `${stage} enqueued`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : `${stage} enqueue failed`;
    return { ok: false, message };
  }
}

/**
 * Enqueue a prospect run for the given zip. ``max`` is per-category
 * (the pipeline searches ~20 categories); a real Provo run with
 * max=2 produced ~35 unique businesses end-to-end.
 *
 * Distinct from triggerStage because prospect doesn't bind to a
 * business — it creates them.
 */
export async function triggerProspect(
  zip: string,
  max: number,
): Promise<TriggerResult> {
  const guard = await requireOwner();
  if (!guard.ok) return { ok: false, message: "Unauthorized" };
  if (!/^\d{5}$/.test(zip)) {
    return { ok: false, message: "Zip must be 5 digits" };
  }
  if (!Number.isInteger(max) || max < 1 || max > 50) {
    return { ok: false, message: "Max must be 1-50" };
  }
  try {
    const job = await triggerProspectOnApi(zip, max);
    return {
      ok: true,
      jobId: job.id,
      status: job.status,
      message: `prospecting ${zip} enqueued`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "prospect enqueue failed";
    return { ok: false, message };
  }
}

/**
 * Poll one job. Returns null when not found. On a terminal status,
 * revalidates the business detail + index pages so the new rows
 * appear once the client re-renders.
 */
/**
 * Send the email outreach draft for a business via the pipeline's
 * Resend integration. Returns ok/message on success or a human-readable
 * error message — the UI surfaces both via toast.
 *
 * Failures here are common: business has no email, draft already sent,
 * RESEND_API_KEY not configured, Resend rate-limit. The API returns
 * structured HTTP codes (400, 404, 409, 503) that the caller can map
 * to UX guidance, but for now the toast just shows the upstream
 * message text.
 */
export async function sendEmailOutreach(
  businessId: number,
  overrideEmail?: string,
): Promise<{ ok: true; sentAt: string | null } | { ok: false; message: string }> {
  const guard = await requireOwner();
  if (!guard.ok) {
    return { ok: false, message: "Owner access required" };
  }
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, message: "invalid business id" };
  }
  try {
    // When the operator typed an address (no email was on file, or they're
    // correcting one), persist it first so the send picks it up and it's on
    // file for next time. The API validates the format and 400s on garbage.
    const typed = overrideEmail?.trim();
    if (typed) {
      await setBusinessEmailOnApi(businessId, typed);
    }
    const result = await sendOutreachEmail(businessId);
    // Revalidate so the status badge flips draft → sent and the
    // business status moves to 'contacted' on next render.
    revalidatePath(`/dashboard/leadgen/${businessId}`);
    revalidatePath("/dashboard/leadgen");
    return { ok: true, sentAt: result.sent_at };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "send failed";
    return { ok: false, message };
  }
}


/**
 * Persist the operator profile (name, email, phone, calendar URL, etc.)
 * that downstream stages use for proposal sign-offs and outreach. Single
 * canonical row — the upstream API enforces id=1 via CHECK constraint.
 *
 * Returns ok=false with a human-readable message on failure so the form
 * can surface it in a toast.error.
 */
export async function saveOperatorProfile(
  profile: OperatorProfile,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const guard = await requireOwner();
  if (!guard.ok) {
    return { ok: false, message: "Owner access required" };
  }
  try {
    await updateOperatorProfile(profile);
    revalidatePath("/dashboard/leadgen/settings");
    // The pipeline reads operator_profile during build + outreach, so
    // detail pages don't need revalidating — they read business rows,
    // not profile rows. New prompts will pick up the change on the
    // NEXT stage run.
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "profile save failed";
    return { ok: false, message };
  }
}


/**
 * Mark a business "Not Interested" with a categorized reason + optional
 * note. Records to the pipeline's status_events audit log (actor = the
 * signed-in operator) and revalidates the detail + index pages so the
 * status badge and filters update.
 */
export async function markNotInterested(
  businessId: number,
  reason: StatusReason,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const guard = await requireOwner();
  if (!guard.ok) {
    return { ok: false, message: "Owner access required" };
  }
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, message: "invalid business id" };
  }
  if (!reason) {
    return { ok: false, message: "a reason is required" };
  }
  try {
    await setBusinessStatusOnApi(businessId, {
      status: "not_interested",
      reason,
      note: note.trim() || null,
      actor: guard.user?.email ?? null,
    });
    revalidatePath(`/dashboard/leadgen/${businessId}`);
    revalidatePath("/dashboard/leadgen");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "failed to update status";
    return { ok: false, message };
  }
}

/**
 * Reopen a previously declined lead, returning it to ``status`` (the status
 * it held before being marked not-interested — the caller derives this from
 * the lead's history, defaulting to "new"). Refuses to "reopen" back into
 * not_interested. Audited the same way as markNotInterested.
 */
export async function reopenLead(
  businessId: number,
  status: BusinessStatus,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const guard = await requireOwner();
  if (!guard.ok) {
    return { ok: false, message: "Owner access required" };
  }
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, message: "invalid business id" };
  }
  if (status === "not_interested") {
    return { ok: false, message: "pick a status to reopen the lead into" };
  }
  try {
    await setBusinessStatusOnApi(businessId, {
      status,
      actor: guard.user?.email ?? null,
    });
    revalidatePath(`/dashboard/leadgen/${businessId}`);
    revalidatePath("/dashboard/leadgen");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "failed to reopen lead";
    return { ok: false, message };
  }
}


/**
 * Save edits to an outreach draft (subject/message). `subject` is only used
 * for the email channel. Revalidates the detail page so the saved copy shows.
 */
export async function saveOutreachDraft(
  businessId: number,
  channel: "email" | "sms" | "phone",
  message: string,
  subject?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const guard = await requireOwner();
  if (!guard.ok) {
    return { ok: false, message: "Owner access required" };
  }
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, message: "invalid business id" };
  }
  if (!message.trim()) {
    return { ok: false, message: "Message can't be empty" };
  }
  try {
    await updateOutreachDraftOnApi(businessId, channel, {
      message,
      subject: channel === "email" ? subject ?? null : null,
    });
    revalidatePath(`/dashboard/leadgen/${businessId}`);
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "failed to save draft";
    return { ok: false, message };
  }
}


/**
 * Record (or update) SMS consent for a business, then revalidate the detail
 * page so the SMS card flips from "record consent" to the send button.
 */
export async function recordSmsConsent(
  businessId: number,
  basis: SmsConsentBasis,
  note?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const guard = await requireOwner();
  if (!guard.ok) return { ok: false, message: "Owner access required" };
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, message: "invalid business id" };
  }
  try {
    await recordSmsConsentOnApi(businessId, basis, note?.trim() || null);
    revalidatePath(`/dashboard/leadgen/${businessId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to record consent";
    return { ok: false, message };
  }
}

/**
 * Send the SMS draft. All compliance guardrails are enforced server-side
 * (consent, opt-out, quiet hours, sender ID + STOP); we just surface the
 * outcome. Revalidates so the draft status flips to sent.
 */
export async function sendSmsOutreach(
  businessId: number,
): Promise<{ ok: true; sentAt: string | null } | { ok: false; message: string }> {
  const guard = await requireOwner();
  if (!guard.ok) return { ok: false, message: "Owner access required" };
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, message: "invalid business id" };
  }
  try {
    const result = await sendSmsOutreachOnApi(businessId);
    revalidatePath(`/dashboard/leadgen/${businessId}`);
    revalidatePath("/dashboard/leadgen");
    return { ok: true, sentAt: result.sent_at };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    return { ok: false, message };
  }
}


export async function pollJob(jobId: string): Promise<JobStatus | null> {
  const guard = await requireOwner();
  if (!guard.ok) return null;
  if (typeof jobId !== "string" || jobId.length === 0) return null;

  try {
    const job = await getJobFromApi(jobId);
    if (job == null) return null;

    if (job.status === "completed" || job.status === "failed") {
      revalidatePath(`/dashboard/leadgen/${job.business_id}`);
      revalidatePath("/dashboard/leadgen");
    }
    return _toJobStatus(job);
  } catch {
    // Transport errors (network blip, API down) are not poll-fatal — the
    // client should keep trying. Returning null tells the UI "no
    // update this tick, try again."
    return null;
  }
}
