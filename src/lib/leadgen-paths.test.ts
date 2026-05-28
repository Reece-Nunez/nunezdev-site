/**
 * Unit tests for the pure helpers in leadgen-paths.ts. Run with:
 *
 *   npm test
 *
 * No DB, no network, no env vars touched. These pin down the contract
 * that the JS sanitizer matches Python's business_output_dir() — they
 * MUST stay aligned or the dashboard can't find the per-business output
 * folder.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { businessOutputDirName } from "./leadgen-paths";

describe("businessOutputDirName", () => {
  it("preserves ASCII letters, digits, spaces, and hyphens", () => {
    assert.equal(
      businessOutputDirName(42, "Joe's Auto-Repair 24/7"),
      // ' and / get replaced with _; space and hyphen pass through
      "Joe_s Auto-Repair 24_7_42",
    );
  });

  it("preserves Unicode letters (mirroring Python's str.isalnum)", () => {
    // This is the regression that justifies the \p{L} fix — old ASCII-only
    // regex produced "Caf__Ol__42" while Python produced "Café Olé_42",
    // and the UI couldn't find the output folder.
    assert.equal(
      businessOutputDirName(7, "Café Olé"),
      "Café Olé_7",
    );
    assert.equal(
      businessOutputDirName(8, "Häagen-Dazs"),
      "Häagen-Dazs_8",
    );
  });

  it("converts trailing dots to underscores (matches Python's lossy mapping)", () => {
    // The `.` is not in the allowed set so the per-char pass converts it
    // to `_` BEFORE the rstrip(".") runs. The rstrip is therefore
    // defensive — it only fires if a future change adds `.` to the
    // allowed set. Both JS and Python agree on this output.
    assert.equal(
      businessOutputDirName(1, "Acme Inc."),
      "Acme Inc__1",
    );
    assert.equal(
      businessOutputDirName(2, "Acme..."),
      "Acme____2",
    );
  });

  it("trims surrounding whitespace", () => {
    assert.equal(
      businessOutputDirName(3, "  Padded Name  "),
      "Padded Name_3",
    );
  });

  it("falls back to 'unnamed' when sanitization yields empty or all underscores", () => {
    assert.equal(businessOutputDirName(10, ""), "unnamed_10");
    assert.equal(businessOutputDirName(11, "!!!"), "unnamed_11");
    assert.equal(businessOutputDirName(12, "***"), "unnamed_12");
  });

  it("always suffixes with the business id, even when names collide", () => {
    // Two franchise locations with identical names get distinct folders.
    const a = businessOutputDirName(17, "Joe's Pizza");
    const b = businessOutputDirName(42, "Joe's Pizza");
    assert.notEqual(a, b);
    assert.match(a, /_17$/);
    assert.match(b, /_42$/);
  });

  it("replaces special characters with underscore (not deletion)", () => {
    // The Python sanitizer maps every disallowed char to '_' rather than
    // dropping it — keeps the output recognizable. Test pins that down.
    assert.equal(
      businessOutputDirName(5, "A&B"),
      "A_B_5",
    );
    assert.equal(
      businessOutputDirName(6, "X@Y.Z"),
      "X_Y_Z_6",
    );
  });
});
