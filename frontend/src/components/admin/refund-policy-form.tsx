"use client";

import { useState, useTransition } from "react";
import { saveRefundPolicyAction } from "@/server/actions/admin/refund-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/app-toast";
import { Calculator, Check, RotateCcw, AlertTriangle } from "lucide-react";
import type { RefundPolicy, RefundPolicyView } from "@/shared/api/admin";

const DEFAULTS: RefundPolicy = {
  fixedFeeCents: 50,
  internationalFeeBps: 150,
  polarFeeBps: 500,
  edoraxFeeBps: 0,
};

export function RefundPolicyForm({ initial }: { initial: RefundPolicyView }) {
  const [fixedFeeCents, setFixedFeeCents] = useState<number>(initial.policy.fixedFeeCents);
  const [internationalFeeBps, setInternationalFeeBps] = useState<number>(initial.policy.internationalFeeBps);
  const [polarFeeBps, setPolarFeeBps] = useState<number>(initial.policy.polarFeeBps);
  const [edoraxFeeBps, setEdoraxFeeBps] = useState<number>(initial.policy.edoraxFeeBps);

  // Example test amount in cents (default $20.00 = 2000 cents)
  const [exampleCents, setExampleCents] = useState<number>(2000);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Derived percentages
  const totalBps = (internationalFeeBps || 0) + (polarFeeBps || 0) + (edoraxFeeBps || 0);
  const totalPercent = (totalBps / 100).toFixed(2);
  const isInvalidTotal = totalBps >= 10000;

  // Real-time breakdown calculation on the example amount
  const paid = Math.max(0, exampleCents || 0);
  const intlFee = Math.round((paid * (internationalFeeBps || 0)) / 10000);
  const polarFee = Math.round((paid * (polarFeeBps || 0)) / 10000);
  const edoraxFee = Math.round((paid * (edoraxFeeBps || 0)) / 10000);
  const fixedFee = Math.max(0, fixedFeeCents || 0);
  const totalFeesKept = fixedFee + intlFee + polarFee + edoraxFee;
  const standardRefund = Math.max(0, paid - totalFeesKept);
  const fullRefund = paid;

  function resetToDefaults() {
    setFixedFeeCents(DEFAULTS.fixedFeeCents);
    setInternationalFeeBps(DEFAULTS.internationalFeeBps);
    setPolarFeeBps(DEFAULTS.polarFeeBps);
    setEdoraxFeeBps(DEFAULTS.edoraxFeeBps);
    setFeedback(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isInvalidTotal) {
      toast("Total percentage fee must stay below 100%.", "error");
      return;
    }

    startTransition(async () => {
      const res = await saveRefundPolicyAction({
        fixedFeeCents: Number(fixedFeeCents),
        internationalFeeBps: Number(internationalFeeBps),
        polarFeeBps: Number(polarFeeBps),
        edoraxFeeBps: Number(edoraxFeeBps),
      });

      setFeedback(res);
      if (res.ok) {
        toast(res.message, "success");
      } else {
        toast(res.message, "error");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Standard refund fee policy</h2>
            <p className="text-sm text-muted-foreground">
              Configure the fees retained by Edorax and Polar when an admin issues a standard refund.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            disabled={isPending}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Reset to defaults
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Fixed Fee */}
          <div className="space-y-2">
            <Label htmlFor="fixedFeeCents" className="flex items-baseline justify-between text-sm font-medium">
              <span>Fixed transaction fee</span>
              <span className="text-xs font-normal text-muted-foreground">
                ${((fixedFeeCents || 0) / 100).toFixed(2)}
              </span>
            </Label>
            <div className="relative">
              <Input
                id="fixedFeeCents"
                type="number"
                min={0}
                step={1}
                value={fixedFeeCents}
                onChange={(e) => setFixedFeeCents(Math.max(0, parseInt(e.target.value, 10) || 0))}
                required
                className="pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                cents
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Fixed card gateway processing charge retained on every refund (default: 50¢).
            </p>
          </div>

          {/* International Fee */}
          <div className="space-y-2">
            <Label htmlFor="internationalFeeBps" className="flex items-baseline justify-between text-sm font-medium">
              <span>International card fee</span>
              <span className="text-xs font-normal text-muted-foreground">
                {((internationalFeeBps || 0) / 100).toFixed(2)}%
              </span>
            </Label>
            <div className="relative">
              <Input
                id="internationalFeeBps"
                type="number"
                min={0}
                step={1}
                value={internationalFeeBps}
                onChange={(e) => setInternationalFeeBps(Math.max(0, parseInt(e.target.value, 10) || 0))}
                required
                className="pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                bps
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              International card assessment fee (100 bps = 1.00%, default: 150 bps = 1.5%).
            </p>
          </div>

          {/* Polar Fee */}
          <div className="space-y-2">
            <Label htmlFor="polarFeeBps" className="flex items-baseline justify-between text-sm font-medium">
              <span>Polar platform fee</span>
              <span className="text-xs font-normal text-muted-foreground">
                {((polarFeeBps || 0) / 100).toFixed(2)}%
              </span>
            </Label>
            <div className="relative">
              <Input
                id="polarFeeBps"
                type="number"
                min={0}
                step={1}
                value={polarFeeBps}
                onChange={(e) => setPolarFeeBps(Math.max(0, parseInt(e.target.value, 10) || 0))}
                required
                className="pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                bps
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Polar processor fee not returned upon refund (default: 500 bps = 5.0%).
            </p>
          </div>

          {/* Edorax Fee */}
          <div className="space-y-2">
            <Label htmlFor="edoraxFeeBps" className="flex items-baseline justify-between text-sm font-medium">
              <span>Edorax platform fee</span>
              <span className="text-xs font-normal text-muted-foreground">
                {((edoraxFeeBps || 0) / 100).toFixed(2)}%
              </span>
            </Label>
            <div className="relative">
              <Input
                id="edoraxFeeBps"
                type="number"
                min={0}
                step={1}
                value={edoraxFeeBps}
                onChange={(e) => setEdoraxFeeBps(Math.max(0, parseInt(e.target.value, 10) || 0))}
                required
                className="pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                bps
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Edorax internal administrative fee retained (default: 0 bps = 0.0%).
            </p>
          </div>
        </div>

        {/* Total Fee Indicator */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5 text-xs">
          <span className="font-medium text-muted-foreground">Total percentage fee:</span>
          <span className={`font-semibold tabular-nums ${isInvalidTotal ? "text-destructive" : "text-foreground"}`}>
            {totalPercent}% ({totalBps} bps)
          </span>
        </div>

        {isInvalidTotal && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span>The total fee rate must be under 100% (under 10,000 basis points).</span>
          </div>
        )}

        {feedback?.message && (
          <p
            role={feedback.ok ? "status" : "alert"}
            className={`text-sm ${feedback.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
          >
            {feedback.message}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" disabled={isPending || isInvalidTotal} className="gap-2">
            {isPending ? "Saving…" : "Save refund policy"}
          </Button>
        </div>
      </form>

      {/* Live Preview Calculator Card */}
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Live refund preview</h3>
              <p className="text-xs text-muted-foreground">
                See how the saved policy applies to any order amount in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="testAmount" className="text-xs text-muted-foreground">
              Order amount ($):
            </Label>
            <Input
              id="testAmount"
              type="number"
              min={1}
              step={1}
              value={((exampleCents || 0) / 100).toFixed(0)}
              onChange={(e) => setExampleCents(Math.max(100, (parseFloat(e.target.value) || 0) * 100))}
              className="h-8 w-24 text-right tabular-nums text-xs"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {/* Option 1: Standard Refund */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Option 1: Standard</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Default
              </span>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                ${(standardRefund / 100).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Learner refund (minus fees)</p>
            </div>
            <div className="mt-4 space-y-1.5 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Fixed fee:</span>
                <span className="tabular-nums">-${(fixedFee / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>International card fee:</span>
                <span className="tabular-nums">-${(intlFee / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Polar platform fee:</span>
                <span className="tabular-nums">-${(polarFee / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Edorax platform fee:</span>
                <span className="tabular-nums">-${(edoraxFee / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-1 font-medium text-foreground">
                <span>Total fees kept:</span>
                <span className="tabular-nums">-${(totalFeesKept / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Option 2: Full Refund */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Option 2: Full
              </span>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                ${(fullRefund / 100).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Full purchase returned</p>
            </div>
            <div className="mt-4 space-y-1.5 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              <p className="leading-relaxed">
                Edorax absorbs the <strong className="text-foreground">${(totalFeesKept / 100).toFixed(2)}</strong> in
                fees. Requires an admin justification reason.
              </p>
            </div>
          </div>

          {/* Option 3: Custom Refund */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Option 3: Custom
              </span>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                $0.01 – ${(fullRefund / 100).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Admin-specified amount</p>
            </div>
            <div className="mt-4 space-y-1.5 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              <p className="leading-relaxed">
                Admin specifies an exact amount up to the order maximum. Requires an admin justification reason.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
