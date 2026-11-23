import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFUND_POLICY,
  allRefundOptions,
  refundBreakdown,
  refundEndsAccess,
  resolveRefundCents,
  validateRefundPolicy,
  type RefundPolicy,
} from "../../../../src/services/payments/refund-policy.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const P = DEFAULT_REFUND_POLICY; // fixedFeeCents:50, international:150bps, polar:500bps, edorax:0bps
const INTL: RefundPolicy = { ...P, internationalFeeBps: 150 };
const DOMESTIC: RefundPolicy = { ...P, internationalFeeBps: 0 };

// ─── refundBreakdown ──────────────────────────────────────────────────────────

describe("refundBreakdown", () => {
  it("keeps back $0.50, 1.5% international and 5% polar from a $10.00 payment", () => {
    // 1000 - 50 - 15 - 50 - 0 = 885
    expect(refundBreakdown(1000, P)).toEqual({
      paidCents: 1000,
      fixedFeeCents: 50,
      internationalFeeCents: 15,
      platformFeeCents: 50,
      edoraxFeeCents: 0,
      refundCents: 885,
    });
  });

  it("omits the international fee when internationalFeeBps is 0 (domestic)", () => {
    // 1000 - 50 - 0 - 50 - 0 = 900
    expect(refundBreakdown(1000, DOMESTIC)).toMatchObject({ internationalFeeCents: 0, refundCents: 900 });
  });

  it("includes Edorax fee when edoraxFeeBps is non-zero", () => {
    const p: RefundPolicy = { ...P, edoraxFeeBps: 200 }; // extra 2%
    // 1000 - 50 - 15 - 50 - 20 = 865
    expect(refundBreakdown(1000, p)).toMatchObject({ edoraxFeeCents: 20, refundCents: 865 });
  });

  it("rounds the international fee to the nearest cent", () => {
    expect(refundBreakdown(100, P).internationalFeeCents).toBe(2); // 1.5 → rounds to 2
    expect(refundBreakdown(1033, P).internationalFeeCents).toBe(15); // 15.495 → rounds to 15
  });

  it("never goes below zero when fees are as much as or more than the payment", () => {
    expect(refundBreakdown(50, P).refundCents).toBe(0);
    expect(refundBreakdown(0, P).refundCents).toBe(0);
  });

  it("changes outcome when any of the four fee fields change", () => {
    const base = refundBreakdown(2000, P).refundCents;
    expect(refundBreakdown(2000, { ...P, fixedFeeCents: 100 }).refundCents).toBe(base - 50);
    expect(refundBreakdown(2000, { ...P, internationalFeeBps: 300 }).refundCents).toBeLessThan(base);
    expect(refundBreakdown(2000, { ...P, polarFeeBps: 1000 }).refundCents).toBeLessThan(base);
    expect(refundBreakdown(2000, { ...P, edoraxFeeBps: 100 }).refundCents).toBeLessThan(base);
  });
});

// ─── validateRefundPolicy ─────────────────────────────────────────────────────

describe("validateRefundPolicy", () => {
  it("accepts the default policy", () => {
    expect(validateRefundPolicy(DEFAULT_REFUND_POLICY)).toBe(true);
  });

  it("rejects negative values", () => {
    expect(validateRefundPolicy({ ...P, fixedFeeCents: -1 })).toBe(false);
    expect(validateRefundPolicy({ ...P, edoraxFeeBps: -50 })).toBe(false);
  });

  it("rejects non-integer values", () => {
    expect(validateRefundPolicy({ ...P, fixedFeeCents: 0.5 })).toBe(false);
    expect(validateRefundPolicy({ ...P, polarFeeBps: 1.5 })).toBe(false);
  });

  it("rejects when total percentage >= 100%", () => {
    // 10000 bps = 100%; not valid
    expect(validateRefundPolicy({ ...P, internationalFeeBps: 5000, polarFeeBps: 5000, edoraxFeeBps: 0 })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validateRefundPolicy(null)).toBe(false);
    expect(validateRefundPolicy("string")).toBe(false);
    expect(validateRefundPolicy(42)).toBe(false);
  });
});

// ─── allRefundOptions ─────────────────────────────────────────────────────────

describe("allRefundOptions", () => {
  it("returns all three amounts and maxCustomCents", () => {
    const opts = allRefundOptions(1000, 0, P);
    expect(opts.fullCents).toBe(1000);
    expect(opts.standardCents).toBe(885); // 1000-50-15-50
    expect(opts.maxCustomCents).toBe(1000);
    expect(opts.breakdown.refundCents).toBe(885);
  });

  it("caps fullCents by prior refunds", () => {
    const opts = allRefundOptions(1000, 300, P);
    expect(opts.fullCents).toBe(700);
    expect(opts.maxCustomCents).toBe(700);
  });

  it("caps standardCents at the remaining balance after prior refunds", () => {
    // Standard for $10 = 885; if 300 already refunded, remaining = 700, standard is capped at 700
    const opts = allRefundOptions(1000, 300, P);
    expect(opts.standardCents).toBe(700);
  });
});

// ─── resolveRefundCents ───────────────────────────────────────────────────────

describe("resolveRefundCents", () => {
  it("FULL returns everything remaining", () => {
    expect(resolveRefundCents("FULL", 1000, 0, P)).toBe(1000);
  });

  it("FULL after a prior partial refund returns only what remains", () => {
    expect(resolveRefundCents("FULL", 1000, 115, P)).toBe(885);
  });

  it("STANDARD returns paid minus policy fees", () => {
    expect(resolveRefundCents("STANDARD", 1000, 0, P)).toBe(885);
  });

  it("CUSTOM returns exactly the custom amount when valid", () => {
    expect(resolveRefundCents("CUSTOM", 1000, 0, P, 500)).toBe(500);
  });

  it("CUSTOM at the maximum (order amount) succeeds", () => {
    expect(resolveRefundCents("CUSTOM", 1000, 0, P, 1000)).toBe(1000);
  });

  it("CUSTOM above the maximum throws INVALID_AMOUNT", () => {
    expect(() => resolveRefundCents("CUSTOM", 1000, 0, P, 1001)).toThrow("INVALID_AMOUNT");
  });

  it("CUSTOM of 0 throws INVALID_AMOUNT", () => {
    expect(() => resolveRefundCents("CUSTOM", 1000, 0, P, 0)).toThrow("INVALID_AMOUNT");
  });

  it("CUSTOM without customCents throws", () => {
    expect(() => resolveRefundCents("CUSTOM", 1000, 0, P, undefined)).toThrow();
  });
});

// ─── refundEndsAccess ─────────────────────────────────────────────────────────

describe("refundEndsAccess", () => {
  it('ends access for status "refunded" regardless of amount', () => {
    expect(refundEndsAccess({ status: "refunded", refundedCents: 1000, paidCents: 1000, policy: P })).toBe(true);
    expect(refundEndsAccess({ status: "refunded", refundedCents: 1, paidCents: 1000, policy: P })).toBe(true);
  });

  it("ends access for a partial refund at or above the standard amount", () => {
    expect(refundEndsAccess({ status: "partially_refunded", refundedCents: 885, paidCents: 1000, policy: P })).toBe(true);
    expect(refundEndsAccess({ status: "partially_refunded", refundedCents: 900, paidCents: 1000, policy: P })).toBe(true);
  });

  it("keeps access for a goodwill refund below the standard amount", () => {
    expect(refundEndsAccess({ status: "partially_refunded", refundedCents: 884, paidCents: 1000, policy: P })).toBe(false);
    expect(refundEndsAccess({ status: "partially_refunded", refundedCents: 0, paidCents: 1000, policy: P })).toBe(false);
  });

  it("uses the live policy, so changing fees changes the threshold", () => {
    // With edoraxFeeBps=200 (extra 2%), standard for $10 = 865
    const strictPolicy: RefundPolicy = { ...P, edoraxFeeBps: 200 };
    expect(refundEndsAccess({ status: "partially_refunded", refundedCents: 865, paidCents: 1000, policy: strictPolicy })).toBe(true);
    // 885 (old standard) would still be above the new 865 threshold
    expect(refundEndsAccess({ status: "partially_refunded", refundedCents: 864, paidCents: 1000, policy: strictPolicy })).toBe(false);
  });
});
