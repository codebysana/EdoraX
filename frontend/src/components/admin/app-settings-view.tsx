"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RefundPolicyForm } from "@/components/admin/refund-policy-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Bot,
  CheckCircle2,
  Cpu,
  CreditCard,
  DollarSign,
  Flame,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import type { AppSettingsView, FeatureFlagInfo } from "@/shared/api/admin";

export function AppSettingsDashboard({ data }: { data: AppSettingsView }) {
  const [activeTab, setActiveTab] = useState<"policy" | "flags" | "payment" | "certificate">("policy");
  const [filterQuery, setFilterQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredFlags = data.featureFlags.filter((flag) => {
    const matchesQuery =
      flag.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      flag.key.toLowerCase().includes(filterQuery.toLowerCase()) ||
      flag.description.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || flag.category === categoryFilter;
    return matchesQuery && matchesCategory;
  });

  const enabledCount = data.featureFlags.filter((f) => f.enabled).length;

  const [certificateSettings, setCertificateSettings] = useState(data.certificateSettings);
  const [certificateSaving, setCertificateSaving] = useState(false);
  const [certificateMessage, setCertificateMessage] = useState("");

  async function saveCertificateSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCertificateSaving(true);
    setCertificateMessage("");
    try {
      const saved = await apiFetch<AppSettingsView["certificateSettings"]>("/api/v1/admin/settings/certificate", {
        method: "PUT",
        json: certificateSettings,
      });
      setCertificateSettings(saved);
      setCertificateMessage("Certificate settings saved.");
    } catch (error) {
      setCertificateMessage(error instanceof ApiError ? error.message : "Could not save certificate settings.");
    } finally {
      setCertificateSaving(false);
    }
  }

  async function loadCertificateArtwork(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 700 * 1024) {
      setCertificateMessage("Choose a PNG, JPEG, or WebP image smaller than 700 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCertificateSettings((value) => ({ ...value, imageData: String(reader.result) }));
    reader.onerror = () => setCertificateMessage("Could not read that image.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("policy")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "policy"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          <DollarSign className="size-4" />
          <span>Refund policy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("flags")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "flags"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="size-4" />
          <span>Feature flags</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
            {enabledCount}/{data.featureFlags.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payment")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "payment"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          <CreditCard className="size-4" />
          <span>Gateway & processor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("certificate")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === "certificate" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
        >
          <ShieldCheck className="size-4" />
          <span>Certificates</span>
        </button>
      </div>

      {/* Tab 1: Refund Policy Form */}
      {activeTab === "policy" && <RefundPolicyForm initial={data.refundPolicy} />}

      {activeTab === "certificate" && (
        <form onSubmit={saveCertificateSettings} className="max-w-3xl space-y-5 rounded-xl border bg-card p-6">
          <div>
            <h3 className="text-base font-semibold">Platform certificate</h3>
            <p className="mt-1 text-sm text-muted-foreground">Set the default issuer and artwork used on learner certificates.</p>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={certificateSettings.enabled} onChange={(event) => setCertificateSettings((value) => ({ ...value, enabled: event.target.checked }))} />
            Automatically issue certificates when course and AI capstone requirements are complete
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["program", "organization", "issuerName"] as const).map((field) => (
              <label key={field} className="space-y-1.5 text-sm">
                <Label htmlFor={`certificate-${field}`}>{field === "issuerName" ? "Issuer name" : field[0]!.toUpperCase() + field.slice(1)}</Label>
                <Input id={`certificate-${field}`} value={certificateSettings[field]} maxLength={120} onChange={(event) => setCertificateSettings((value) => ({ ...value, [field]: event.target.value }))} required />
              </label>
            ))}
          </div>
          <label className="block space-y-2 text-sm">
            <Label htmlFor="certificate-artwork">Certificate artwork (PNG, JPEG, or WebP; max 700 KB)</Label>
            <Input id="certificate-artwork" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void loadCertificateArtwork(event.target.files?.[0])} />
          </label>
          {certificateSettings.imageData ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={certificateSettings.imageData} alt="Certificate artwork preview" className="max-h-64 max-w-full border object-contain" />
              <Button type="button" variant="outline" size="sm" onClick={() => setCertificateSettings((value) => ({ ...value, imageData: null }))}>Remove artwork</Button>
            </div>
          ) : <p className="text-sm text-muted-foreground">No artwork uploaded.</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={certificateSaving} disabled={certificateSaving}>Save certificate settings</Button>
            {certificateMessage ? <p role="status" className="text-sm text-muted-foreground">{certificateMessage}</p> : null}
          </div>
        </form>
      )}

      {/* Tab 2: Feature Flags */}
      {activeTab === "flags" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search feature flags…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "All categories" },
                { id: "gamification", label: "Gamification" },
                { id: "infra", label: "System & Cron" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    categoryFilter === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feature Flags Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredFlags.map((flag) => {
              const CategoryIcon = flag.category === "gamification" ? Flame : Cpu;

              return (
                <div
                  key={flag.key}
                  className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-xs transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <CategoryIcon className="size-3.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold tracking-tight text-foreground">{flag.name}</h4>
                          <code className="text-[11px] font-mono text-muted-foreground">{flag.key}</code>
                        </div>
                      </div>

                      {flag.enabled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <XCircle className="size-3" />
                          Disabled
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{flag.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    <span>Category: {flag.category}</span>
                    <span>Env-configured</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredFlags.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No feature flags found matching your filter.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payment Gateway Overview */}
      {activeTab === "payment" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-semibold">Polar payment integration</h3>
                <p className="text-xs text-muted-foreground">Gateway status and checkout configuration.</p>
              </div>

              {data.polar.configured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-4" />
                  Active & Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Activity className="size-4" />
                  Not configured
                </span>
              )}
            </div>

            <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <dt className="text-muted-foreground">Environment</dt>
                <dd className="mt-1 font-semibold text-foreground uppercase">{data.polar.environment || "Sandbox"}</dd>
              </div>

              <div className="rounded-lg bg-muted/40 p-3">
                <dt className="text-muted-foreground">Refund Modes Supported</dt>
                <dd className="mt-1 font-semibold text-foreground">Standard, Full, Custom</dd>
              </div>

              <div className="rounded-lg bg-muted/40 p-3">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="mt-1 font-semibold text-foreground">USD ($)</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
