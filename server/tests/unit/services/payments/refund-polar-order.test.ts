import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  enrollment: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  payment: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }));
const getRefundPolicyMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/db/prisma.js", () => ({ prisma: db }));
vi.mock("../../../../src/utils/logger.js", () => ({ logger }));
vi.mock("../../../../src/services/payments/refund-policy.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/payments/refund-policy.js")>();
  return { ...actual, getRefundPolicy: getRefundPolicyMock };
});

import { revokePolarOrderRefund } from "../../../../src/services/payments/refund-polar-order.js";
import { DEFAULT_REFUND_POLICY } from "../../../../src/services/payments/refund-policy.js";

const P = DEFAULT_REFUND_POLICY;

const paidEnrollment = (payment: Record<string, unknown> = {}) => ({
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

// $10.00 paid; Standard refund = 1000 - 50 - 15 - 50 = 885 cents → Polar calls it "partially_refunded".
const policyRefund = {
  orderId: "ord_1",
  checkoutId: "chk_1",
  metadata: { enrollmentId: "enr_1" },
  status: "partially_refunded",
  refundedAmount: 885,
  totalAmount: 1000,
};

describe("revokePolarOrderRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
    db.enrollment.findFirst.mockResolvedValue(null);
    db.payment.updateMany.mockResolvedValue({ count: 1 });
    getRefundPolicyMock.mockResolvedValue(P);
  });

  it("removes access for a refund at the Standard policy amount and cancels an unpaid instructor payout", async () => {
    db.enrollment.findUnique.mockResolvedValue(paidEnrollment());

    await expect(revokePolarOrderRefund(policyRefund)).resolves.toEqual({ revoked: true, enrollmentId: "enr_1" });
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "enr_1", status: "SUCCEEDED" },
      data: { status: "REFUNDED", instructorPayoutStatus: "NOT_DUE" },
    });
    expect(db.enrollment.update).toHaveBeenCalledWith({ where: { id: "enr_1" }, data: { lifecycle: "CANCELLED", status: "DROPPED" } });
  });

  it("removes access for a full (status=refunded) refund too", async () => {
    db.enrollment.findUnique.mockResolvedValue(paidEnrollment());
    const result = await revokePolarOrderRefund({ ...policyRefund, status: "refunded", refundedAmount: 1000 });
    expect(result).toEqual({ revoked: true, enrollmentId: "enr_1" });
  });

  it("finds the enrollment by order id when the metadata has none", async () => {
    db.enrollment.findFirst.mockImplementation(
      async ({ where }: { where: { payment: { providerRef: string } } }) =>
        where.payment.providerRef === "ord_1" ? paidEnrollment() : null,
    );
    const result = await revokePolarOrderRefund({ ...policyRefund, metadata: null });
    expect(result).toEqual({ revoked: true, enrollmentId: "enr_1" });
  });

  it("keeps access for a goodwill refund below the Standard amount", async () => {
    db.enrollment.findUnique.mockResolvedValue(paidEnrollment());

    const result = await revokePolarOrderRefund({ ...policyRefund, refundedAmount: 300 });
    expect(result).toEqual({ revoked: false, enrollmentId: "enr_1", reason: "goodwill" });
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it("uses the live policy to decide the threshold (changed edoraxFeeBps lowers the threshold)", async () => {
    db.enrollment.findUnique.mockResolvedValue(paidEnrollment());
    // With edoraxFeeBps=200, Standard for $10 = 865
    getRefundPolicyMock.mockResolvedValue({ ...P, edoraxFeeBps: 200 });

    // 884 would be goodwill under the old policy (threshold 885), but above the new one (865)
    const result = await revokePolarOrderRefund({ ...policyRefund, refundedAmount: 870 });
    expect(result).toEqual({ revoked: true, enrollmentId: "enr_1" });
  });

  it("changes nothing when the admin refund already ended access", async () => {
    db.enrollment.findUnique.mockResolvedValue({ ...paidEnrollment({ status: "REFUNDED" }), lifecycle: "CANCELLED" });

    const result = await revokePolarOrderRefund(policyRefund);
    expect(result).toEqual({ revoked: false, enrollmentId: "enr_1", reason: "already-refunded" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("changes nothing when another delivery won the race (idempotency)", async () => {
    db.enrollment.findUnique.mockResolvedValue(paidEnrollment());
    db.payment.updateMany.mockResolvedValue({ count: 0 });

    const result = await revokePolarOrderRefund(policyRefund);
    expect(result).toEqual({ revoked: false, enrollmentId: "enr_1", reason: "already-refunded" });
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("never removes access that was not paid through Polar", async () => {
    db.enrollment.findUnique.mockResolvedValue(paidEnrollment({ provider: "manual" }));
    const result = await revokePolarOrderRefund(policyRefund);
    expect(result).toEqual({ revoked: false, enrollmentId: "enr_1", reason: "not-polar" });
  });

  it("keeps an instructor payout that was already paid, and flags it", async () => {
    db.enrollment.findUnique.mockResolvedValue(paidEnrollment({ instructorPayoutStatus: "PAID" }));

    await revokePolarOrderRefund(policyRefund);
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "enr_1", status: "SUCCEEDED" },
      data: { status: "REFUNDED" },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentId: "enr_1" }),
      expect.stringMatching(/manual adjustment/),
    );
  });

  it("reports an order it cannot match without failing", async () => {
    db.enrollment.findUnique.mockResolvedValue(null);
    const result = await revokePolarOrderRefund({ ...policyRefund, metadata: null, checkoutId: null });
    expect(result).toEqual({ revoked: false, enrollmentId: null, reason: "no-enrollment" });
  });
});
