import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  enrollment: { findUnique: vi.fn(), update: vi.fn() },
  payment: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
const refundsCreate = vi.hoisted(() => vi.fn());
const refundsList = vi.hoisted(() => vi.fn());
const recordAdminAction = vi.hoisted(() => vi.fn());
const getRefundPolicyMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/db/prisma.js", () => ({ prisma: db }));
vi.mock("../../../../src/utils/logger.js", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../src/services/payments/polar.js", () => ({
  requirePolarConfig: () => ({}),
  getPolarClient: () => ({ refunds: { create: refundsCreate, list: refundsList } }),
}));
vi.mock("../../../../src/services/admin/audit.js", () => ({
  recordAdminAction,
  ADMIN_AUDIT_ACTIONS: { PAYMENT_REFUND: "payment.refund" },
}));
vi.mock("../../../../src/services/payments/refund-policy.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/payments/refund-policy.js")>();
  return { ...actual, getRefundPolicy: getRefundPolicyMock };
});

import { previewCourseRefund, refundCoursePayment } from "../../../../src/services/payments/refund-course-payment.js";
import { DEFAULT_REFUND_POLICY } from "../../../../src/services/payments/refund-policy.js";

const admin = { id: "admin_1", email: "admin@example.com" };
const enrollment = (payment: Record<string, unknown> = {}) => ({
  id: "enr_1",
  lifecycle: "ACTIVE",
  payment: {
    status: "SUCCEEDED",
    provider: "polar",
    providerRef: "ord_1",
    amountCents: 1000,
    instructorPayoutStatus: "PENDING",
    instructorShareCents: 700,
    ...payment,
  },
});

describe("refundCoursePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
    db.payment.updateMany.mockResolvedValue({ count: 1 });
    refundsCreate.mockResolvedValue({ id: "ref_1" });
    refundsList.mockResolvedValue({ items: [] });
    getRefundPolicyMock.mockResolvedValue(DEFAULT_REFUND_POLICY);
  });

  // ─── STANDARD (default) ───────────────────────────────────────────────────

  it("STANDARD: refunds paid minus fees ($0.50 + 1.5% + 5%), ends access and records who did it", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());

    const result = await refundCoursePayment("enr_1", admin, { mode: "STANDARD", reason: "customer_request" });

    // 1000 - 50 - 15 - 50 = 885
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "ord_1", amount: 885, metadata: expect.objectContaining({ enrollmentId: "enr_1", refundMode: "STANDARD" }) }),
    );
    expect(result).toMatchObject({ refundId: "ref_1", mode: "STANDARD", refundCents: 885 });
    expect(db.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED" }) }));
    expect(db.enrollment.update).toHaveBeenCalledWith({ where: { id: "enr_1" }, data: { lifecycle: "CANCELLED", status: "DROPPED" } });
    expect(recordAdminAction).toHaveBeenCalledWith(db, expect.objectContaining({ actor: admin, action: "payment.refund", targetId: "enr_1" }));
  });

  // ─── FULL ─────────────────────────────────────────────────────────────────

  it("FULL: returns everything and ends access", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());

    const result = await refundCoursePayment("enr_1", admin, { mode: "FULL", reason: "customer_request" });

    expect(refundsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000 }));
    expect(result).toMatchObject({ mode: "FULL", refundCents: 1000 });
    expect(db.payment.updateMany).toHaveBeenCalled();
  });

  it("FULL: requires a reason", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());
    await expect(refundCoursePayment("enr_1", admin, { mode: "FULL" })).rejects.toThrow(/reason/i);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  // ─── CUSTOM ───────────────────────────────────────────────────────────────

  it("CUSTOM: refunds the exact amount typed, capped at order total", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());

    const result = await refundCoursePayment("enr_1", admin, {
      mode: "CUSTOM",
      customCents: 600,
      reason: "satisfaction_guarantee",
    });

    expect(refundsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 600 }));
    expect(result).toMatchObject({ mode: "CUSTOM", refundCents: 600 });
  });

  it("CUSTOM at the maximum (order amount) succeeds", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());
    const result = await refundCoursePayment("enr_1", admin, {
      mode: "CUSTOM",
      customCents: 1000,
      reason: "customer_request",
    });
    expect(result.refundCents).toBe(1000);
  });

  it("CUSTOM above the order total is rejected", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());
    await expect(
      refundCoursePayment("enr_1", admin, { mode: "CUSTOM", customCents: 1001, reason: "other" }),
    ).rejects.toThrow(/invalid/i);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("CUSTOM: requires a reason", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());
    await expect(refundCoursePayment("enr_1", admin, { mode: "CUSTOM", customCents: 500 })).rejects.toThrow(/reason/i);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  // ─── Preview ──────────────────────────────────────────────────────────────

  it("previews all three amounts without refunding", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());
    const preview = await previewCourseRefund("enr_1");

    expect(preview).toMatchObject({
      fullCents: 1000,
      standardCents: 885,
      maxCustomCents: 1000,
    });
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  // ─── Validations ──────────────────────────────────────────────────────────

  it("refuses when fees would take the whole payment", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment({ amountCents: 50 }));
    await expect(refundCoursePayment("enr_1", admin, { mode: "STANDARD" })).rejects.toThrow(/nothing to refund/);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("refuses a payment that is already refunded or not made through Polar", async () => {
    db.enrollment.findUnique.mockResolvedValueOnce(enrollment({ status: "REFUNDED" }));
    await expect(refundCoursePayment("enr_1", admin, { mode: "STANDARD" })).rejects.toThrow(/already been refunded/);
    db.enrollment.findUnique.mockResolvedValueOnce(enrollment({ provider: "manual" }));
    await expect(refundCoursePayment("enr_1", admin, { mode: "STANDARD" })).rejects.toThrow(/not paid through Polar/);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("changes nothing in the database when Polar refuses the refund", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());
    refundsCreate.mockRejectedValue(new Error("Polar said no"));

    await expect(refundCoursePayment("enr_1", admin, { mode: "STANDARD" })).rejects.toThrow(/Polar said no/);
    expect(db.payment.updateMany).not.toHaveBeenCalled();
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  // ─── revokeAccess = false ─────────────────────────────────────────────────

  it("when revokeAccess is false, Polar is called but enrollment is not cancelled", async () => {
    db.enrollment.findUnique.mockResolvedValue(enrollment());

    await refundCoursePayment("enr_1", admin, { mode: "STANDARD", revokeAccess: false });

    expect(refundsCreate).toHaveBeenCalled();
    expect(db.payment.updateMany).not.toHaveBeenCalled();
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });
});
