/**
 * Unit tests for the integration auto-discovery matchers. Run with:
 *
 *   npm test
 *
 * No network. These pin the conservative apex-hostname matching that decides
 * which Vercel project / GA4 property belongs to a client — getting this wrong
 * would wire a client's report to someone else's analytics.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apexHostname, matchByApex, gscSiteApex } from "./discover";

describe("apexHostname", () => {
  it("strips protocol, path, and leading www", () => {
    assert.equal(apexHostname("https://www.example.com/about"), "example.com");
    assert.equal(apexHostname("http://example.com"), "example.com");
    assert.equal(apexHostname("example.com"), "example.com");
    assert.equal(apexHostname("www.Example.COM"), "example.com");
  });

  it("keeps non-www subdomains intact", () => {
    assert.equal(apexHostname("https://app.example.com"), "app.example.com");
    assert.equal(apexHostname("shop.example.co.uk/cart"), "shop.example.co.uk");
  });

  it("returns null for empty / unparseable input", () => {
    assert.equal(apexHostname(""), null);
    assert.equal(apexHostname(null), null);
    assert.equal(apexHostname(undefined), null);
    assert.equal(apexHostname("   "), null);
  });
});

describe("matchByApex", () => {
  it("matches regardless of www / protocol differences", () => {
    assert.equal(matchByApex("example.com", ["www.example.com"]), "www.example.com");
    assert.equal(matchByApex("example.com", ["https://example.com/"]), "https://example.com/");
  });

  it("returns the first matching domain", () => {
    assert.equal(matchByApex("example.com", ["foo.com", "example.com", "bar.com"]), "example.com");
  });

  it("does NOT match a different apex (no false wiring)", () => {
    assert.equal(matchByApex("example.com", ["example.net", "notexample.com"]), null);
  });

  it("ignores null/empty candidate domains", () => {
    assert.equal(matchByApex("example.com", [null, undefined, "", "example.com"]), "example.com");
  });
});

describe("gscSiteApex", () => {
  it("handles URL-prefix properties", () => {
    assert.equal(gscSiteApex("https://www.example.com/"), "example.com");
    assert.equal(gscSiteApex("https://example.com/"), "example.com");
  });

  it("handles domain properties (sc-domain:)", () => {
    assert.equal(gscSiteApex("sc-domain:example.com"), "example.com");
    assert.equal(gscSiteApex("sc-domain:www.example.com"), "example.com");
  });

  it("returns null for empty input", () => {
    assert.equal(gscSiteApex(""), null);
    assert.equal(gscSiteApex(null), null);
  });

  it("lets a client hostname match either GSC property kind", () => {
    const target = apexHostname("https://www.example.com/contact");
    assert.equal(gscSiteApex("sc-domain:example.com") === target, true);
    assert.equal(gscSiteApex("https://example.com/") === target, true);
  });
});
