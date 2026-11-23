"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MyCertificateListItem } from "@/shared/lib/certificates";

// One request serves every finished course card on the page. It only reads the learner's own list,
// so opening My learning never issues a certificate.
let listRequest: Promise<MyCertificateListItem[]> | null = null;
function loadMyCertificates(): Promise<MyCertificateListItem[]> {
  if (!listRequest) {
    listRequest = apiFetch<{ certificates: MyCertificateListItem[] }>("/api/v1/certificates/mine")
      .then((result) => result.certificates)
      .catch(() => [])
      .finally(() => {
        // Forget it shortly after, so a certificate issued later shows on the next visit.
        window.setTimeout(() => { listRequest = null; }, 10_000);
      });
  }
  return listRequest;
}

/** A "View certificate" button for a finished course card. It renders nothing until a certificate exists. */
export function CourseCertificateLink({ courseSlug, className }: { courseSlug: string; className?: string }) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadMyCertificates().then((items) => {
      const match = items.find((item) => item.courseSlug === courseSlug && !item.revokedAt);
      if (live && match) setCode(match.code);
    });
    return () => {
      live = false;
    };
  }, [courseSlug]);

  if (!code) return null;
  return (
    <Link href={`/verify/${code}`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11", className)}>
      <Award aria-hidden /> View certificate
    </Link>
  );
}
