"use client";

import { useState, useTransition } from "react";
import { Award, Check } from "lucide-react";
import { updateCourseCertificateTemplate } from "@/server/actions/modules";
import { CERTIFICATE_TEMPLATES, DEFAULT_CERTIFICATE_TEMPLATE, type CertificateTemplateId } from "@/shared/lib/certificates";
import { cn } from "@/lib/utils";

/** Lets the instructor pick the certificate design learners of this course receive. */
export function CourseCertificatePanel({ courseId, template }: { courseId: string; template: CertificateTemplateId }) {
  const [selected, setSelected] = useState<CertificateTemplateId>(template);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(next: CertificateTemplateId) {
    if (next === selected || pending) return;
    const previous = selected;
    setSelected(next);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCourseCertificateTemplate({ courseId, template: next });
      if (!result.ok) {
        setSelected(previous);
        setError(result.errors[0] ?? "Could not save the certificate design.");
        return;
      }
      setSaved(true);
    });
  }

  return (
    <section id="certificate" className="scroll-mt-24 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="certificate-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary"><Award className="size-5" aria-hidden /></span>
        <div>
          <h2 id="certificate-heading" className="text-lg font-semibold tracking-tight">Certificate design</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Pick the design learners get when they finish this course. Certificates already issued keep the design they were issued with. This choice overrides `certificate.template` in course.yaml.</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Certificate design" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CERTIFICATE_TEMPLATES.map((option) => {
          const active = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(option.id)}
              className={cn("overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/40")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/certificate-preview/${option.id}`} alt={`${option.label} design preview`} width={1536} height={1024} loading="lazy" className="block h-auto w-full border-b bg-muted/30" />
              <span className="flex items-start justify-between gap-3 p-3">
                <span>
                  <span className="block text-sm font-semibold">{option.label}{option.id === DEFAULT_CERTIFICATE_TEMPLATE ? " (default)" : ""}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                </span>
                {active ? <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs">
        {pending ? <span className="text-muted-foreground">Saving...</span> : error ? <span className="text-destructive">{error}</span> : saved ? <span className="text-muted-foreground">Saved. New certificates for this course use this design.</span> : null}
      </p>
    </section>
  );
}
