import { prisma } from "../../db/prisma.js";
import { ADMIN_AUDIT_ACTIONS, recordAdminAction, type AdminActor } from "../admin/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/errors.js";
import { getPolarClient, requirePolarConfig } from "./polar.js";
import { endAccessForRefund } from "./refund-polar-order.js";
import {
  allRefundOptions,
  getRefundPolicy,
  refundBreakdown,
  resolveRefundCents,
  type AllRefundOptions,
  type RefundMode,
} from "./refund-policy.js";

export const REFUND_REASONS = [
  "customer_request",
  "duplicate",
  "fraudulent",
  "service_disruption",
  "satisfaction_guarantee",
  "other",
] as const;
export type RefundReasonInput = (typeof REFUND_REASONS)[number];

export type CourseRefundResult = {
  refundId: string;
  enrollmentId: string;
  mode: RefundMode;
  refundCents: number;
};

// ─── Preview ──────────────────────────────────────────────────────────────────

/**
 * Returns all three option amounts for the confirm dialog without issuing anything.
 * Uses the live saved policy so the UI shows the same numbers as the actual refund.
 */
export async function previewCourseRefund(enrollmentId: string): Promise<AllRefundOptions & { paidCents: number; alreadyRefundedCents: number; currency: string }> {
  const payment = await refundablePayment(enrollmentId);
  const policy = await getRefundPolicy();
  const alreadyRefundedCents = await getPriorRefundedCents(payment.providerRef);
  return {
    ...allRefundOptions(payment.amountCents, alreadyRefundedCents, policy),
    paidCents: payment.amountCents,
    alreadyRefundedCents,
    currency: payment.currency,
  };
}

// ─── Issue refund ─────────────────────────────────────────────────────────────

export type RefundInput = {
  mode: RefundMode;
  /** Required when mode === "CUSTOM". Max = remaining order amount. */
  customCents?: number;
  reason?: RefundReasonInput;
  comment?: string | null;
  /** End the learner's access immediately. Defaults to true. */
  revokeAccess?: boolean;
};

/**
 * Refund a course bought through Polar.
 *
 * - FULL: returns everything remaining; Edorax absorbs the fees. Requires a reason.
 * - STANDARD: returns paid minus the saved policy fees. No reason required.
 * - CUSTOM: admin types an amount from $0.01 up to the full order amount. Requires a reason.
 *
 * Access is ended immediately (revokeAccess defaults to true). The Polar webhook then finds the
 * payment already REFUNDED and changes nothing.
 */
export async function refundCoursePayment(
  enrollmentId: string,
  actor: AdminActor,
  input: RefundInput,
): Promise<CourseRefundResult> {
  requirePolarConfig();

  const { mode, customCents, reason, comment, revokeAccess = true } = input;

  // Validate that a reason is provided for FULL and CUSTOM modes.
  if ((mode === "FULL" || mode === "CUSTOM") && !reason) {
    throw new BadRequestError(
      `A reason is required for ${mode} refunds.`,
      "REASON_REQUIRED",
    );
  }

  const payment = await refundablePayment(enrollmentId);
  const policy = await getRefundPolicy();
  const alreadyRefundedCents = await getPriorRefundedCents(payment.providerRef);

  let refundCents: number;
  try {
    refundCents = resolveRefundCents(mode, payment.amountCents, alreadyRefundedCents, policy, customCents);
  } catch (err) {
    const isInvalidAmount = err instanceof Error && err.message === "INVALID_AMOUNT";
    // For STANDARD mode, INVALID_AMOUNT means the fees ate the whole payment.
    if (isInvalidAmount && mode === "STANDARD") {
      throw new BadRequestError(
        "The fees kept back are as much as the payment, so there is nothing to refund.",
        "REFUND_TOO_SMALL",
      );
    }
    throw new BadRequestError(
      "The refund amount is invalid or exceeds the order total.",
      "REFUND_INVALID_AMOUNT",
    );
  }

  if (refundCents < 1) {
    throw new BadRequestError(
      "The fees kept back are as much as the payment, so there is nothing to refund.",
      "REFUND_TOO_SMALL",
    );
  }

  // Build the Polar comment from the breakdown for Standard refunds.
  const breakdown = refundBreakdown(payment.amountCents, policy);
  const defaultComment =
    mode === "STANDARD"
      ? `Refund less fees: fixed ${breakdown.fixedFeeCents}c, international ${breakdown.internationalFeeCents}c, Polar ${breakdown.platformFeeCents}c, Edorax ${breakdown.edoraxFeeCents}c.`
      : mode === "FULL"
        ? "Full refund (Edorax absorbed fees)."
        : `Custom refund of ${refundCents} cents.`;

  const refund = await getPolarClient().refunds.create({
    order_id: payment.providerRef,
    amount: refundCents,
    reason: reason ?? "customer_request",
    comment: comment?.trim() || defaultComment,
    metadata: { enrollmentId, refundedBy: actor.id, refundMode: mode },
  });

  // Money has gone back. If the DB write below fails the order.refunded webhook still ends access,
  // because refundCents >= Standard amount for FULL/STANDARD, and handles CUSTOM gracefully.
  await prisma.$transaction(async (tx) => {
    if (revokeAccess) {
      await endAccessForRefund(tx, { id: enrollmentId, payment: { ...payment, provider: "polar" } });
    }
    await recordAdminAction(tx, {
      actor,
      action: ADMIN_AUDIT_ACTIONS.PAYMENT_REFUND,
      targetType: "Enrollment",
      targetId: enrollmentId,
      summary: `Refunded ${refundCents} of ${payment.amountCents} cents (${mode}) through Polar${revokeAccess ? " and removed course access" : ""}.`,
      metadata: {
        refundId: refund.id,
        orderId: payment.providerRef,
        mode,
        refundCents,
        paidCents: payment.amountCents,
        alreadyRefundedCents,
        revokeAccess,
        policySnapshot: policy,
        feeBreakdownSnapshot: breakdown,
        decisionDetails: {
          mode,
          requestedCustomCents: mode === "CUSTOM" ? customCents : null,
          resolvedRefundCents: refundCents,
          remainingBeforeRefundCents: Math.max(0, payment.amountCents - alreadyRefundedCents),
          reason: reason ?? null,
          revokeAccess,
        },
        reason: reason ?? "customer_request",
      },
    });
  });

  return { refundId: refund.id, enrollmentId, mode, refundCents };
}

/** Sum successful refunds at Polar so external or earlier partial refunds reduce the balance. */
async function getPriorRefundedCents(orderId: string): Promise<number> {
  let page = 1;
  let totalCents = 0;
  while (true) {
    const refunds = await getPolarClient().refunds.list({ order_id: orderId, succeeded: true, limit: 100, page });
    totalCents += refunds.items.reduce((sum, refund) => sum + refund.amount, 0);
    if (refunds.items.length < 100) return totalCents;
    page += 1;
  }
}

// ─── Shared guard ─────────────────────────────────────────────────────────────

async function refundablePayment(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { payment: true },
  });
  if (!enrollment) throw new NotFoundError("Enrollment not found");
  const payment = enrollment.payment;
  if (!payment || payment.provider !== "polar" || !payment.providerRef) {
    throw new ConflictError(
      "This enrollment was not paid through Polar, so it cannot be refunded here.",
      "NOT_A_POLAR_PAYMENT",
    );
  }
  if (payment.status === "REFUNDED")
    throw new ConflictError("This payment has already been refunded.", "ALREADY_REFUNDED");
  if (payment.status !== "SUCCEEDED")
    throw new ConflictError("Only a completed payment can be refunded.", "PAYMENT_NOT_COMPLETED");
  return { ...payment, providerRef: payment.providerRef };
}
