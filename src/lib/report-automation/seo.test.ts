/**
 * Unit tests for the broken-link classifier. Run with:
 *
 *   npm test
 *
 * No DB, no network. These pin the rule that only hard-dead responses
 * (404 / 410 / 5xx) count as "broken", so the client report stops crying wolf
 * over social links that answer bots with 403/429/301-to-login while loading
 * fine in a real browser (the Jones Legacy Creations May 2026 false positive).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyLink, detectCharset, type LinkVerdict } from "./seo";

describe("classifyLink", () => {
  it("counts 404, 410, and 5xx as broken", () => {
    for (const status of [404, 410, 500, 502, 503, 599]) {
      assert.equal(classifyLink(status), "broken", `status ${status}`);
    }
  });

  it("treats 2xx and resolved 3xx as ok", () => {
    for (const status of [200, 204, 301, 302, 307, 308]) {
      assert.equal(classifyLink(status), "ok", `status ${status}`);
    }
  });

  it("does NOT count auth / anti-bot / rate-limit as broken", () => {
    // These are exactly what Instagram/Facebook return to the report bot.
    for (const status of [401, 403, 405, 429]) {
      assert.equal(classifyLink(status), "unverified", `status ${status}`);
    }
  });

  it("treats a network error / timeout (status 0) as unverified, not broken", () => {
    assert.equal(classifyLink(0), "unverified");
  });

  it("never reports the JLC footer social links as broken", () => {
    // Observed responses to a bot HEAD: FB 301→login, IG 200 or 429.
    const observed = [200, 429, 301];
    const broken = observed
      .map(classifyLink)
      .filter((v: LinkVerdict) => v === "broken");
    assert.equal(broken.length, 0);
  });
});

describe("detectCharset", () => {
  it("prefers the Content-Type header charset", () => {
    assert.equal(detectCharset("text/html; charset=windows-1252", ""), "windows-1252");
    assert.equal(detectCharset("text/html; charset=UTF-8", ""), "utf-8");
  });

  it("falls back to the <meta charset> when the header omits it", () => {
    assert.equal(detectCharset("text/html", '<meta charset="ISO-8859-1">'), "iso-8859-1");
    assert.equal(detectCharset(null, '<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">'), "windows-1252");
  });

  it("defaults to utf-8 when nothing declares a charset", () => {
    assert.equal(detectCharset("text/html", "<html><head></head>"), "utf-8");
    assert.equal(detectCharset(null, ""), "utf-8");
  });
});
