/**
 * Unit tests for the overdue-invoice SMS dunning ladder (pure parts). Run with:
 *   npx tsx --test src/lib/invoiceDunningSms.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  selectDunningTier,
  renderDunningBody,
  renderShutdownBody,
  shutdownApprovalDue,
  cyclesBehind,
  isChronicNonPayer,
  renderChronicDirectBody,
  formatUsd,
  invoicePayUrl,
  DUNNING_LADDER,
  SHUTDOWN_DAYS,
  CHRONIC_MIN_CYCLES,
  type DunningStep,
} from "./invoiceDunningSms";

describe("selectDunningTier", () => {
  it("returns null before the first rung is due", () => {
    assert.equal(selectDunningTier(0, []), null);
    assert.equal(selectDunningTier(2, []), null);
  });

  it("advances through rungs at their thresholds on a normal timeline", () => {
    assert.equal(selectDunningTier(3, [])?.tier, "gentle");
    assert.equal(selectDunningTier(10, ["gentle"])?.tier, "firm");
    assert.equal(selectDunningTier(21, ["gentle", "firm"])?.tier, "urgent");
  });

  it("returns null once the current (highest-due) rung is already sent", () => {
    assert.equal(selectDunningTier(5, ["gentle"]), null); // still in gentle window
    assert.equal(selectDunningTier(25, ["urgent"]), null); // urgent already sent
  });

  it("jumps a very-late invoice straight to its current rung (no ladder replay)", () => {
    // 52 days overdue, nothing sent yet -> highest due is 'urgent', not 'gentle'.
    assert.equal(selectDunningTier(52, [])?.tier, "urgent");
  });

  it("does not regress to a lower rung after the top rung is sent", () => {
    // The reverse-cascade bug guard: urgent sent, gentle/firm never sent.
    assert.equal(selectDunningTier(53, ["urgent"]), null);
  });

  it("never picks 'shutdown' - that rung is not in the auto ladder", () => {
    for (let d = 0; d <= 120; d++) {
      const tier = selectDunningTier(d, [])?.tier;
      assert.notEqual(tier, "shutdown");
    }
  });
});

describe("shutdownApprovalDue", () => {
  it("is false before the 35-day threshold", () => {
    assert.equal(shutdownApprovalDue(21, { alreadyQueued: false }), false);
    assert.equal(shutdownApprovalDue(SHUTDOWN_DAYS - 1, { alreadyQueued: false }), false);
  });

  it("is true at/after 35 days when nothing is queued", () => {
    assert.equal(shutdownApprovalDue(SHUTDOWN_DAYS, { alreadyQueued: false }), true);
    assert.equal(shutdownApprovalDue(52, { alreadyQueued: false }), true);
  });

  it("never re-queues once an approval exists (pending, approved, or dismissed)", () => {
    assert.equal(shutdownApprovalDue(52, { alreadyQueued: true }), false);
  });
});

describe("renderShutdownBody", () => {
  const ctx = {
    firstName: "Aaron",
    invoiceNumber: "INV-1042",
    amount: "$1,200.00",
    daysOverdue: 40,
    payUrl: "https://www.nunezdev.com/invoice/tok123",
  };

  it("warns about suspension, carries STOP + pay link, no em dashes", () => {
    const body = renderShutdownBody(ctx);
    assert.match(body, /suspension of your website/i);
    assert.match(body, /Reply STOP to opt out/i);
    assert.match(body, /invoice\/tok123/);
    assert.doesNotMatch(body, /—/);
  });

  it("omits the pay link cleanly when there is none", () => {
    const body = renderShutdownBody({ ...ctx, payUrl: "" });
    assert.doesNotMatch(body, /https?:\/\//);
    assert.match(body, /Reply STOP to opt out/i);
  });
});

describe("cyclesBehind", () => {
  it("divides outstanding by the monthly amount, floored", () => {
    assert.equal(cyclesBehind(28000, 4000), 7); // Aaron: $280 / $40
    assert.equal(cyclesBehind(12000, 4000), 3);
    assert.equal(cyclesBehind(11999, 4000), 2); // floors, doesn't round up
  });

  it("is 0 when the monthly amount is unknown/zero (no divide-by-zero)", () => {
    assert.equal(cyclesBehind(28000, 0), 0);
  });
});

describe("isChronicNonPayer", () => {
  it("flags an active-recurring client 3+ cycles behind (Aaron's shape)", () => {
    assert.equal(
      isChronicNonPayer({ hasActiveRecurring: true, outstandingOverdueCents: 28000, monthlyCents: 4000 }),
      true,
    );
  });

  it("requires >= CHRONIC_MIN_CYCLES cycles behind", () => {
    const twoMonths = (CHRONIC_MIN_CYCLES - 1) * 4000;
    assert.equal(
      isChronicNonPayer({ hasActiveRecurring: true, outstandingOverdueCents: twoMonths, monthlyCents: 4000 }),
      false,
    );
  });

  it("never flags a client without an active recurring plan", () => {
    assert.equal(
      isChronicNonPayer({ hasActiveRecurring: false, outstandingOverdueCents: 100000, monthlyCents: 4000 }),
      false,
    );
  });

  it("never flags when the monthly amount is zero", () => {
    assert.equal(
      isChronicNonPayer({ hasActiveRecurring: true, outstandingOverdueCents: 100000, monthlyCents: 0 }),
      false,
    );
  });
});

describe("renderChronicDirectBody", () => {
  const ctx = { firstName: "Aaron", amount: "$280.00", cyclesBehind: 7, payUrl: "https://www.nunezdev.com/invoice/tok" };

  it("is blunt, names the total + months, carries STOP + link, no em dashes", () => {
    const body = renderChronicDirectBody(ctx);
    assert.match(body, /seriously past due/i);
    assert.match(body, /\$280\.00 outstanding across 7 unpaid months/);
    assert.match(body, /invoice\/tok/);
    assert.match(body, /Reply STOP to opt out/i);
    assert.doesNotMatch(body, /—/);
  });

  it("uses singular 'month' when exactly one cycle behind", () => {
    assert.match(renderChronicDirectBody({ ...ctx, cyclesBehind: 1 }), /1 unpaid month of service/);
  });

  it("omits the pay link cleanly when there is none", () => {
    assert.doesNotMatch(renderChronicDirectBody({ ...ctx, payUrl: "" }), /https?:\/\//);
  });
});

describe("renderDunningBody", () => {
  const ctx = {
    firstName: "Aaron",
    invoiceNumber: "INV-1042",
    amount: "$500.00",
    daysOverdue: 21,
    payUrl: "https://www.nunezdev.com/invoice/tok123",
  };
  const byTier = (t: string) => DUNNING_LADDER.find((s) => s.tier === t) as DunningStep;

  it("includes the STOP notice on every rung", () => {
    for (const step of DUNNING_LADDER) {
      assert.match(renderDunningBody(step, ctx), /Reply STOP to opt out/i);
    }
  });

  it("uses no em dashes (house SMS style)", () => {
    for (const step of DUNNING_LADDER) {
      assert.doesNotMatch(renderDunningBody(step, ctx), /—/);
    }
  });

  it("embeds the pay link when present, omits it cleanly when absent", () => {
    const withUrl = renderDunningBody(byTier("gentle"), ctx);
    assert.match(withUrl, /invoice\/tok123/);
    const noUrl = renderDunningBody(byTier("gentle"), { ...ctx, payUrl: "" });
    assert.doesNotMatch(noUrl, /https?:\/\//);
  });

  it("urgent rung warns about service being paused", () => {
    assert.match(renderDunningBody(byTier("urgent"), ctx), /site and services active/i);
  });
});

describe("formatUsd", () => {
  it("formats cents as USD", () => {
    assert.equal(formatUsd(123400), "$1,234.00");
    assert.equal(formatUsd(50000), "$500.00");
    assert.equal(formatUsd(0), "$0.00");
  });
});

describe("invoicePayUrl", () => {
  it("prefers the access-token public link", () => {
    assert.equal(
      invoicePayUrl({ access_token: "abc", hosted_invoice_url: "https://stripe/x" }, "https://site"),
      "https://site/invoice/abc",
    );
  });

  it("falls back to the hosted invoice url, then empty string", () => {
    assert.equal(invoicePayUrl({ hosted_invoice_url: "https://stripe/x" }), "https://stripe/x");
    assert.equal(invoicePayUrl({}), "");
    assert.equal(invoicePayUrl({ access_token: null, hosted_invoice_url: null }), "");
  });
});
