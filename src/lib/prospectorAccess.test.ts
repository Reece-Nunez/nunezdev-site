/**
 * Unit tests for the prospector allowlist. Run with: npm test
 *
 * This is the contract the middleware backstop relies on, so the denied cases
 * (financial routes, dashboard overview root) matter as much as the allowed
 * ones — a regression here is a data-exposure regression.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPathAllowedForProspector, PROSPECTOR_NAV_HREFS } from "./prospectorAccess";

describe("isPathAllowedForProspector", () => {
  it("allows the leadgen / leads / thumbtack page surface", () => {
    for (const p of [
      "/dashboard/leadgen",
      "/dashboard/leadgen/",
      "/dashboard/leadgen/ads",
      "/dashboard/leadgen/follow-ups",
      "/dashboard/leadgen/123",
      "/dashboard/leads",
      "/dashboard/leads/abc",
      "/dashboard/thumbtack",
    ]) {
      assert.equal(isPathAllowedForProspector(p), true, p);
    }
  });

  it("allows the leadgen/leads API routes those screens call", () => {
    for (const p of [
      "/api/admin/leads",
      "/api/admin/leads/123",
      "/api/admin/leads/123/convert",
      "/api/admin/lead-sources",
      "/api/admin/import-thumbtack-leads",
      "/api/admin/cleanup-duplicate-thumbtack",
      "/api/leadgen/file/some/path.pdf",
    ]) {
      assert.equal(isPathAllowedForProspector(p), true, p);
    }
  });

  it("denies the dashboard overview root and financial / sensitive pages", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/invoices",
      "/dashboard/payments",
      "/dashboard/expenses",
      "/dashboard/clients",
      "/dashboard/client-reports",
      "/dashboard/settings",
      "/dashboard/inbox",
    ]) {
      assert.equal(isPathAllowedForProspector(p), false, p);
    }
  });

  it("denies financial and other sensitive API routes", () => {
    for (const p of [
      "/api/invoices",
      "/api/invoices/123/send",
      "/api/payments",
      "/api/expenses",
      "/api/client-reports",
      "/api/proposals",
      "/api/clients/123/charge-saved-card",
      "/api/stripe/webhook",
      "/api/dashboard/overview",
    ]) {
      assert.equal(isPathAllowedForProspector(p), false, p);
    }
  });

  it("does not allow prefix-spoofing paths (segment-aware match)", () => {
    assert.equal(isPathAllowedForProspector("/api/admin/leads-export-secret"), false);
    assert.equal(isPathAllowedForProspector("/dashboard/leadgenerator"), false);
  });

  it("every prospector nav href is itself allowed", () => {
    for (const href of PROSPECTOR_NAV_HREFS) {
      assert.equal(isPathAllowedForProspector(href), true, href);
    }
  });
});
