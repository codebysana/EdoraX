import { z } from "zod";
import { id, params } from "./common.js";

export const selfEnrollBody = z.object({ courseId: id, couponCode: z.string().trim().min(3).max(32).optional() });
export const enrollmentParams = params("enrollmentId");
export const refundBody = z
  .object({
    /** Which of the three refund options the admin chose. Defaults to STANDARD. */
    mode: z.enum(["FULL", "STANDARD", "CUSTOM"]).default("STANDARD"),
    /** Required when mode === "CUSTOM". Positive integer, max = order amount in cents. */
    customCents: z.number().int().min(1).optional(),
    reason: z
      .enum(["customer_request", "duplicate", "fraudulent", "service_disruption", "satisfaction_guarantee", "other"])
      .optional(),
    comment: z.string().trim().max(500).optional(),
    /** End the learner's access immediately. Defaults to true. */
    revokeAccess: z.boolean().default(true),
  })
  .refine((b) => b.mode !== "CUSTOM" || b.customCents !== undefined, {
    message: "customCents is required for CUSTOM refunds.",
    path: ["customCents"],
  })
  .refine((b) => b.mode !== "FULL" || b.reason !== undefined, {
    message: "A reason is required for FULL refunds.",
    path: ["reason"],
  })
  .refine((b) => b.mode !== "CUSTOM" || b.reason !== undefined, {
    message: "A reason is required for CUSTOM refunds.",
    path: ["reason"],
  });
export type RefundBody = z.infer<typeof refundBody>;

/** Admin edit of an enrollment: course access and payment status only. Only the fields sent change. */
export const adminEnrollmentUpdateBody = z
  .object({
    lifecycle: z.enum(["PENDING_ACCOUNT", "PAYMENT_REQUIRED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]).optional(),
    paymentStatus: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).optional(),
  })
  .strict()
  .refine((body) => body.lifecycle !== undefined || body.paymentStatus !== undefined, { message: "Nothing to update." });
export type AdminEnrollmentUpdateBody = z.infer<typeof adminEnrollmentUpdateBody>;
