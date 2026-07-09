// Pure completion logic for the dashboard bulk-run progress bar, split out from
// BulkRunProvider so it can be unit-tested without a React harness.

/** A single poll of the batch-progress endpoint (see bulkJobProgress). */
export type JobProgressSnapshot = {
  /** How many of the polled job ids the pipeline actually found as rows. */
  matched: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
};

export type BulkProgressEval = {
  /** Terminal jobs, for the "X/Y done" readout. */
  done: number;
  failed: number;
  /** True once the run has no more work left — close the bar. */
  finished: boolean;
};

/**
 * Decide, from one progress poll, whether a bulk run is finished.
 *
 * A run is finished when nothing is left to run — zero queued AND zero running.
 * We deliberately do NOT wait for completed+failed to reach the enqueued
 * `total`: some enqueued job ids may never materialize as rows (matched < total),
 * and jobs cancelled or left in any non-completed/-failed terminal state drop
 * out of every status bucket. Either case leaves completed+failed permanently
 * short of total, which hung the progress bar forever (the bug this replaces) —
 * the operator would then hit Stop and see "cancelled 0" because everything had
 * actually finished already.
 *
 * The `matched > 0` guard avoids a premature close on the first poll if the
 * just-enqueued jobs haven't registered as rows yet: with matched === 0, queued
 * and running also read 0, which would otherwise look "finished" instantly.
 */
export function evalBulkProgress(
  p: JobProgressSnapshot,
  total: number,
): BulkProgressEval {
  const done = p.completed + p.failed;
  const pending = p.queued + p.running;
  const finished = (p.matched > 0 && pending === 0) || done >= total;
  return { done, failed: p.failed, finished };
}
