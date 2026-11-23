import { serverApiFetch } from "@/lib/api-server";
import { requireRole } from "@/server/auth/guards";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AppSettingsDashboard } from "@/components/admin/app-settings-view";
import type { AppSettingsView } from "@/shared/api/admin";

export default async function AdminAppSettingsPage() {
  await requireRole("ADMIN");
  const data = await serverApiFetch<AppSettingsView>("/api/v1/admin/settings/app");

  return (
    <div className="max-w-5xl space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Platform console"
        title="App settings & feature flags"
        description="Configure refund policy fees, inspect platform feature flags, and monitor integrations."
      />

      <AppSettingsDashboard data={data} />
    </div>
  );
}
