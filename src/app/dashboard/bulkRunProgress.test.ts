/**
 * Unit tests for evalBulkProgress — the bulk-run completion decision. Run with:
 *
 *   npm test
 *
 * No React, no DB, no env vars touched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evalBulkProgress, type JobProgressSnapshot } from "./bulkRunProgress";

function snap(p: Partial<JobProgressSnapshot>): JobProgressSnapshot {
  return { matched: 0, queued: 0, running: 0, completed: 0, failed: 0, ...p };
}

describe("evalBulkProgress", () => {
  it("is not finished while jobs are still queued or running", () => {
    const r = evalBulkProgress(
      snap({ matched: 5, queued: 2, running: 1, completed: 2, failed: 0 }),
      5,
    );
    assert.equal(r.finished, false);
    assert.equal(r.done, 2);
  });

  it("finishes when every matched job is terminal (completed+failed = total)", () => {
    const r = evalBulkProgress(
      snap({ matched: 5, completed: 4, failed: 1 }),
      5,
    );
    assert.equal(r.finished, true);
    assert.equal(r.done, 5);
    assert.equal(r.failed, 1);
  });

  it("finishes when some ids never materialized (matched < total) — the hang bug", () => {
    // 5 enqueued, but only 3 rows exist; all 3 are done. completed+failed (3)
    // never reaches total (5), yet nothing is pending — must still finish.
    const r = evalBulkProgress(
      snap({ matched: 3, completed: 3, failed: 0 }),
      5,
    );
    assert.equal(r.finished, true);
    assert.equal(r.done, 3);
  });

  it("finishes when jobs ended in an uncounted terminal state (cancelled)", () => {
    // Matched jobs exist but landed outside completed/failed (e.g. cancelled),
    // so nothing is queued/running — the run is over.
    const r = evalBulkProgress(
      snap({ matched: 4, queued: 0, running: 0, completed: 1, failed: 0 }),
      4,
    );
    assert.equal(r.finished, true);
  });

  it("does NOT finish prematurely before any job registers (matched === 0)", () => {
    // First poll right after enqueue: rows not yet visible. matched/queued/
    // running all 0 must NOT read as finished.
    const r = evalBulkProgress(snap({}), 5);
    assert.equal(r.finished, false);
    assert.equal(r.done, 0);
  });
});
