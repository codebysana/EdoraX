// Admin service: read and update the platform-wide refund policy.
// The policy drives what the learner gets back on a Standard refund, the
// refund dialog options and the webhook access-revocation threshold.

import { ADMIN_AUDIT_ACTIONS, type AdminActor } from "./audit.js";
import {
  DEFAULT_REFUND_POLICY,
  getRefundPolicy,
  refundBreakdown,
  saveRefundPolicy,
  validateRefundPolicy,
  type RefundPolicy,
} from "../payments/refund-policy.js";
import { prisma } from "../../db/prisma.js";
import { BadRequestError } from "../../utils/errors.js";

export type RefundPolicyView = {
  policy: RefundPolicy;
  /** Example: a $20 domestic order. */
  example: {
    paidCents: number;
    standardRefundCents: number;
    fullRefundCents: number;
  };
};

/** Returns the live saved policy plus an example calculation for the settings UI. */
export async function getRefundPolicyAdmin(): Promise<RefundPolicyView> {
  const policy = await getRefundPolicy();
  const examplePaid = 2000; // $20.00
  const bd = refundBreakdown(examplePaid, policy);
  return {
    policy,
    example: {
      paidCents: examplePaid,
      standardRefundCents: bd.refundCents,
      fullRefundCents: examplePaid,
    },
  };
}

/** Validates, saves and audit-logs a new refund policy. */
export async function updateRefundPolicyAdmin(
  newPolicy: unknown,
  actor: AdminActor,
): Promise<RefundPolicyView> {
  if (!validateRefundPolicy(newPolicy)) {
    throw new BadRequestError(
      "Invalid refund policy: all values must be non-negative integers and total percentage must be under 100%.",
      "INVALID_REFUND_POLICY",
    );
  }

  const previous = await getRefundPolicy();
  await saveRefundPolicy(newPolicy as RefundPolicy);

  await prisma.adminAuditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: ADMIN_AUDIT_ACTIONS.REFUND_POLICY_CHANGED,
      targetType: "Platform",
      summary: `Updated refund policy: fixed ${newPolicy.fixedFeeCents}c, international ${newPolicy.internationalFeeBps}bps, Polar ${newPolicy.polarFeeBps}bps, Edorax ${newPolicy.edoraxFeeBps}bps.`,
      metadata: { previous, updated: newPolicy },
    },
  });

  return getRefundPolicyAdmin();
}

export { DEFAULT_REFUND_POLICY };
