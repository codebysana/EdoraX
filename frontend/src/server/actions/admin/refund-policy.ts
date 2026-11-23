"use server";

import { revalidatePath } from "next/cache";
import { adminCall } from "./call";
import { runAdminAction, type AdminActionState } from "./action-result";
import type { RefundPolicy, RefundPolicyView } from "@/shared/api/admin";

const PATH = "/api/v1/admin/settings/refund-policy";

export async function saveRefundPolicyAction(policy: RefundPolicy): Promise<AdminActionState> {
  return runAdminAction(async () => {
    await adminCall<RefundPolicyView>(PATH, { method: "PUT", json: policy });
    revalidatePath("/admin/settings/refund-policy");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/course-access");
    revalidatePath("/admin/audit");
    return "Refund policy saved successfully.";
  });
}
