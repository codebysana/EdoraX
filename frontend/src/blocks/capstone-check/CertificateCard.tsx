"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { CertificateView, MyCertificateState } from "@/shared/lib/certificates";

// Shown at the end of a finished course (and under a capstone check). Certificates are issued
// automatically, so this gives the learner the verify link and Add to LinkedIn at any time.

export function CertificateCard({ courseSlug }: { courseSlug: string }) {
  const [state, setState] = useState<MyCertificateState | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<MyCertificateState>(`/api/v1/courses/${encodeURIComponent(courseSlug)}/certificate`)
      .then((result) => {
        if (!live) return;
        setState(result);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [courseSlug]);

  useEffect(() => {
    if (!state?.eligibility.eligible || state.certificate) return;
    const timer = window.setInterval(() => {
      apiFetch<MyCertificateState>(`/api/v1/courses/${encodeURIComponent(courseSlug)}/certificate`)
        .then(setState)
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [courseSlug, state?.certificate, state?.eligibility.eligible]);

  if (!state || !state.eligibility.offered) return null;

  const certificate = state.certificate;
  return (
    <section className="space-y-3 border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Award className="size-4" />
        Your certificate
      </p>
      {certificate ? (
        <>
          <p className="text-sm leading-6">
            {certificate.title}, issued to {certificate.recipientName}. Certificate {certificate.code}.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={certificate.linkedInAddUrl} target="_blank" rel="noreferrer noopener" className={cn(buttonVariants({ size: "sm" }))}>
              Add to LinkedIn
            </a>
            <Link href={`/verify/${certificate.code}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              <Award className="size-4" aria-hidden />
              View certificate
            </Link>
          </div>
        </>
      ) : state.eligibility.eligible ? (
        <p className="text-sm text-muted-foreground">Your certificate is being prepared. Refresh this page in a moment.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {state.eligibility.missing.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}
