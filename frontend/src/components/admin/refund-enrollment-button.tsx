"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { formatPriceCents } from "@/lib/format-price";
import type { AdminRefundMode, AdminRefundOptions } from "@/shared/api/admin";
import { toast } from "@/components/ui/app-toast";

const reasons = [
  ["customer_request", "Customer request"],
  ["duplicate", "Duplicate payment"],
  ["fraudulent", "Fraudulent"],
  ["service_disruption", "Service disruption"],
  ["satisfaction_guarantee", "Satisfaction guarantee"],
  ["other", "Other"],
] as const;

const modes: { value: AdminRefundMode; label: string; description: string }[] = [
  { value: "STANDARD", label: "Standard", description: "Refund the payment less the saved policy fees." },
  { value: "FULL", label: "Full", description: "Refund the remaining balance; Edorax absorbs the fees." },
  { value: "CUSTOM", label: "Custom", description: "Choose an exact amount up to the remaining balance." },
];

export function RefundEnrollmentButton({
  enrollmentId,
  courseTitle,
  eligible,
}: {
  enrollmentId: string;
  courseTitle: string;
  eligible: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AdminRefundOptions | null>(null);
  const [mode, setMode] = useState<AdminRefundMode>("STANDARD");
  const [customAmount, setCustomAmount] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [revokeAccess, setRevokeAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const previewController = useRef<AbortController | null>(null);

  function openDialog() {
    previewController.current?.abort();
    const controller = new AbortController();
    previewController.current = controller;
    setOpen(true);
    setPreview(null);
    setLoadingPreview(true);
    setError(null);
    apiFetch<AdminRefundOptions>(`/api/v1/admin/enrollments/${encodeURIComponent(enrollmentId)}/refund`, {
      signal: controller.signal,
    })
      .then((options) => setPreview(options))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load refund options.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingPreview(false); });
  }

  function closeDialog() {
    previewController.current?.abort();
    previewController.current = null;
    setOpen(false);
  }

  if (!eligible) return null;

  const money = (amount: number) => formatPriceCents(amount, preview?.currency);
  const customCents = Math.round(Number(customAmount) * 100);
  const amountCents = mode === "FULL"
    ? preview?.fullCents ?? 0
    : mode === "STANDARD"
      ? preview?.standardCents ?? 0
      : customCents;
  const needsReason = mode !== "STANDARD";
  const canSubmit = Boolean(
    preview && !loadingPreview && amountCents > 0 && amountCents <= preview.maxCustomCents &&
    Number.isInteger(amountCents) && (!needsReason || reason),
  );

  function issueRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || !canSubmit) return;
    setError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/api/v1/admin/enrollments/${encodeURIComponent(enrollmentId)}/refund`, {
          method: "POST",
          json: {
            mode,
            ...(mode === "CUSTOM" ? { customCents } : {}),
            ...(reason ? { reason } : {}),
            ...(comment.trim() ? { comment: comment.trim() } : {}),
            revokeAccess,
          },
        });
        toast(`Refund of ${money(amountCents)} issued through Polar${revokeAccess ? "; course access removed" : ""}.`, "success");
        closeDialog();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Refund could not be issued.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        Refund
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/70 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) closeDialog();
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`refund-title-${enrollmentId}`} className="my-auto max-h-[min(92vh,850px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Polar payment refund</p>
                <h2 id={`refund-title-${enrollmentId}`} className="mt-1 text-xl font-semibold">Refund {courseTitle}</h2>
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={closeDialog}>Close</Button>
            </div>

            {loadingPreview ? <p className="py-8 text-sm text-muted-foreground">Loading saved policy and refund balance…</p> : null}
            {error && !preview ? <p role="alert" className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

            {preview ? (
              <form onSubmit={issueRefund} className="mt-5 space-y-5">
                <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Paid</span><strong>{money(preview.paidCents)}</strong></div>
                  {preview.alreadyRefundedCents > 0 ? <div className="mt-1 flex justify-between gap-4"><span className="text-muted-foreground">Previously refunded</span><strong>−{money(preview.alreadyRefundedCents)}</strong></div> : null}
                  <div className="mt-1 flex justify-between gap-4 border-t border-border pt-1"><span className="text-muted-foreground">Remaining balance</span><strong>{money(preview.maxCustomCents)}</strong></div>
                </div>

                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">Choose refund amount</legend>
                  {modes.map((option) => {
                    const value = option.value === "FULL" ? preview.fullCents : option.value === "STANDARD" ? preview.standardCents : null;
                    return (
                      <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === option.value ? "border-primary bg-primary/5" : "border-border"}`}>
                        <input type="radio" name={`refund-mode-${enrollmentId}`} value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} className="mt-1 accent-primary" />
                        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2 font-medium"><span>{option.label}{option.value === "STANDARD" ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Default</span> : null}</span>{value !== null ? <strong className="tabular-nums">{money(value)}</strong> : null}</span><span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span></span>
                      </label>
                    );
                  })}
                </fieldset>

                {mode === "CUSTOM" ? (
                  <div className="space-y-2">
                    <Label htmlFor={`refund-custom-${enrollmentId}`}>Exact refund amount ({preview.currency})</Label>
                    <Input id={`refund-custom-${enrollmentId}`} type="number" inputMode="decimal" step="0.01" min="0.01" max={(preview.maxCustomCents / 100).toFixed(2)} value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} required />
                    <p className="text-xs text-muted-foreground">From {money(1)} to {money(preview.maxCustomCents)}. The server checks the live balance again when issuing.</p>
                  </div>
                ) : null}

                {needsReason ? (
                  <div className="space-y-2">
                    <Label htmlFor={`refund-reason-${enrollmentId}`}>Reason (required)</Label>
                    <select id={`refund-reason-${enrollmentId}`} value={reason} onChange={(event) => setReason(event.target.value)} required className="h-11 w-full rounded-md border-2 border-input bg-card px-3 text-sm">
                      <option value="">Choose a reason</option>
                      {reasons.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor={`refund-comment-${enrollmentId}`}>Internal note (optional)</Label>
                  <textarea id={`refund-comment-${enrollmentId}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={2} className="w-full rounded-md border-2 border-input bg-card px-3 py-2 text-sm" placeholder="Add context to the Polar refund record" />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
                  <input type="checkbox" checked={revokeAccess} onChange={(event) => setRevokeAccess(event.target.checked)} className="mt-1 accent-primary" />
                  <span><strong>Remove course access</strong><span className="mt-0.5 block text-xs text-muted-foreground">On by default. The enrollment will be cancelled immediately.</span></span>
                </label>

                {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">Learner receives <strong className="text-foreground">{money(amountCents)}</strong></p>
                  <Button type="submit" variant="destructive" disabled={!canSubmit || pending}>
                    {pending ? "Issuing refund…" : `Issue ${money(amountCents)} refund`}
                  </Button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
