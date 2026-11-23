// How much of a course payment comes back on a refund. The fees on the sale are not returned: a
// fixed transaction fee per payment, an international card fee, Polar's 5% fee and Edorax's own
// fee (currently 0). These four values are stored in the database so an admin can update them;
// the defaults below seed the first run. The admin refund, the webhook and every preview screen
// all call getRefundPolicy() so they always read the same live values.

import { prisma } from "../../db/prisma.js";

// ─── Policy type & defaults ───────────────────────────────────────────────────

export type RefundPolicy = {
  /** Fixed transaction fee kept back on every refund, in cents. Default: 50 ($0.50). */
  fixedFeeCents: number;
  /** International card fee kept back, in basis points. Default: 150 (1.5%). */
  internationalFeeBps: number;
  /** Polar's platform fee kept back, in basis points. Default: 500 (5%). */
  polarFeeBps: number;
  /** Edorax's own fee kept back, in basis points. Default: 0. */
  edoraxFeeBps: number;
};

export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  fixedFeeCents: 50,
  internationalFeeBps: 150,
  polarFeeBps: 500,
  edoraxFeeBps: 0,
};

// Storage key used in the key-value settings table.
const POLICY_SETTING_KEY = "refund_policy";

// ─── Policy persistence ───────────────────────────────────────────────────────

/** Loads the saved refund policy, falling back to DEFAULT_REFUND_POLICY if none is saved yet. */
export async function getRefundPolicy(): Promise<RefundPolicy> {
  const row = await prisma.appSetting.findUnique({ where: { key: POLICY_SETTING_KEY } });
  if (!row) return { ...DEFAULT_REFUND_POLICY };
  try {
    const parsed: unknown = JSON.parse(row.value as string);
    return validateRefundPolicy(parsed) ? (parsed as RefundPolicy) : { ...DEFAULT_REFUND_POLICY };
  } catch {
    return { ...DEFAULT_REFUND_POLICY };
  }
}

/** Persists a new refund policy. Throws when the values fail validation. */
export async function saveRefundPolicy(policy: RefundPolicy): Promise<void> {
  if (!validateRefundPolicy(policy)) throw new Error("Invalid refund policy values.");
  await prisma.appSetting.upsert({
    where: { key: POLICY_SETTING_KEY },
    update: { value: JSON.stringify(policy) },
    create: { key: POLICY_SETTING_KEY, value: JSON.stringify(policy) },
  });
}

/**
 * Returns true when every field is a non-negative integer and the total percentage fee is under 100%.
 * Used by the save endpoint and by getRefundPolicy to guard against corrupt stored values.
 */
export function validateRefundPolicy(policy: unknown): policy is RefundPolicy {
  if (!policy || typeof policy !== "object") return false;
  const p = policy as Record<string, unknown>;
  const fields: (keyof RefundPolicy)[] = ["fixedFeeCents", "internationalFeeBps", "polarFeeBps", "edoraxFeeBps"];
  for (const f of fields) {
    if (!Number.isInteger(p[f]) || (p[f] as number) < 0) return false;
  }
  const totalBps =
    (p.internationalFeeBps as number) + (p.polarFeeBps as number) + (p.edoraxFeeBps as number);
  return totalBps < 10_000; // must stay under 100%
}

// ─── Breakdown type & calculation ────────────────────────────────────────────

export type RefundBreakdown = {
  paidCents: number;
  fixedFeeCents: number;
  internationalFeeCents: number;
  platformFeeCents: number;
  edoraxFeeCents: number;
  /** What the learner gets back for a Standard refund. 0 when fees exceed the payment. */
  refundCents: number;
};

const share = (cents: number, bps: number) => Math.round((cents * bps) / 10_000);

/** Breaks down the Standard refund amount for a given payment using a live policy (or default policy if omitted). */
export function refundBreakdown(paidCents: number, policy: RefundPolicy = DEFAULT_REFUND_POLICY): RefundBreakdown {
  const paid = Math.max(0, Math.round(paidCents));
  const internationalFeeCents = share(paid, policy.internationalFeeBps);
  const platformFeeCents = share(paid, policy.polarFeeBps);
  const edoraxFeeCents = share(paid, policy.edoraxFeeBps);
  const refundCents = Math.max(
    0,
    paid - policy.fixedFeeCents - internationalFeeCents - platformFeeCents - edoraxFeeCents,
  );
  return {
    paidCents: paid,
    fixedFeeCents: policy.fixedFeeCents,
    internationalFeeCents,
    platformFeeCents,
    edoraxFeeCents,
    refundCents,
  };
}

// ─── Three-mode refund resolution ────────────────────────────────────────────

export type RefundMode = "FULL" | "STANDARD" | "CUSTOM";

export type AllRefundOptions = {
  /** Everything not yet refunded — Edorax absorbs fees. */
  fullCents: number;
  /** Paid minus policy fees — the default selection. */
  standardCents: number;
  /** Fee breakdown used to derive standardCents (for the UI). */
  breakdown: RefundBreakdown;
  /** Ceiling for a custom amount (equals fullCents). */
  maxCustomCents: number;
};

/** Returns all three option amounts for the refund dialog, without issuing anything. */
export function allRefundOptions(
  paidCents: number,
  alreadyRefundedCents: number,
  policy: RefundPolicy,
): AllRefundOptions {
  const max = Math.max(0, paidCents - alreadyRefundedCents);
  const breakdown = refundBreakdown(paidCents, policy);
  return {
    fullCents: max,
    standardCents: Math.min(breakdown.refundCents, max),
    breakdown,
    maxCustomCents: max,
  };
}

/**
 * Resolves the actual refund amount for a given mode.
 * - FULL: everything remaining (Edorax absorbs fees).
 * - STANDARD: paid minus policy fees, capped at remaining.
 * - CUSTOM: the value the admin typed, validated against 1..max.
 * Throws "INVALID_AMOUNT" when the resolved amount is out of [1, max].
 */
export function resolveRefundCents(
  mode: RefundMode,
  paidCents: number,
  alreadyRefundedCents: number,
  policy: RefundPolicy,
  customCents?: number,
): number {
  const max = Math.max(0, paidCents - alreadyRefundedCents);
  let amount: number;
  if (mode === "FULL") {
    amount = max;
  } else if (mode === "STANDARD") {
    amount = Math.min(refundBreakdown(paidCents, policy).refundCents, max);
  } else {
    if (customCents === undefined) throw new Error("CUSTOM mode requires customCents.");
    amount = customCents;
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > max) {
    throw new Error("INVALID_AMOUNT");
  }
  return amount;
}

// ─── Webhook helper ───────────────────────────────────────────────────────────

/**
 * Whether a Polar webhook refund ends the learner's access.
 * A full ("refunded") status always does. A partial refund does when it reaches or exceeds the
 * Standard policy amount. A smaller one is goodwill and access stays.
 */
export function refundEndsAccess(input: {
  status: string;
  refundedCents: number;
  paidCents: number;
  policy: RefundPolicy;
}) {
  if (input.status === "refunded") return true;
  const standard = refundBreakdown(input.paidCents, input.policy).refundCents;
  return input.refundedCents > 0 && input.refundedCents >= standard;
}
