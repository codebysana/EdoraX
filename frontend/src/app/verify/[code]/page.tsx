import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/site";
import { issuedOn, loadCertificate } from "./certificate-data";

// Public certificate page: anyone with the link can confirm a certificate is real.
// The certificate is drawn once, in certificate-artwork.tsx, and shown here as the PNG from
// render-certificate.tsx, so a LinkedIn post and the page it opens look like the same document.

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const certificate = await loadCertificate(code);
  if (!certificate) return { title: "Certificate not found", robots: { index: false } };
  const title = `${certificate.recipientName}: ${certificate.title}`;
  const description = `${certificate.organization} certificate ${certificate.code}, issued ${issuedOn(certificate.issuedAt)}.`;
  return {
    title,
    description,
    // Verify pages are for people who have the link, not for search results.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: SITE_NAME, url: certificate.verifyUrl },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { code } = await params;
  const certificate = await loadCertificate(code);
  if (!certificate) notFound();
  const revoked = certificate.revokedAt !== null;

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4 text-sm">
          <Link href="/" className="font-heading text-base font-bold tracking-tight">{SITE_NAME}</Link>
          <span className="text-muted-foreground">Certificate check</span>
        </div>

        <div
          className={revoked ? "flex items-start gap-3 border border-destructive/40 bg-destructive/10 p-4 text-sm" : "flex items-start gap-3 border border-ok bg-ok-soft p-4 text-sm"}
          role="status"
        >
          {revoked ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" /> : <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" />}
          <p className="leading-6">
            {revoked
              ? `This certificate was withdrawn on ${issuedOn(certificate.revokedAt!)}.${certificate.revokedReason ? ` Reason: ${certificate.revokedReason}` : ""}`
              : `This certificate is genuine. ${certificate.organization} issued it to ${certificate.recipientName} on ${issuedOn(certificate.issuedAt)}.`}
          </p>
        </div>

        {/* The document itself: the same PNG that Download image saves and LinkedIn previews. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/verify/${certificate.code}/image`}
          alt={`Certificate of completion. ${certificate.recipientName} completed ${certificate.title}. Issued by ${certificate.organization} on ${issuedOn(certificate.issuedAt)}. Certificate ID ${certificate.code}.`}
          width={1536}
          height={1024}
          className="block h-auto w-full border border-border shadow-sm"
        />

        {!revoked ? (
          <div className="flex flex-wrap gap-3">
            <a href={certificate.linkedInAddUrl} target="_blank" rel="noreferrer noopener" className={cn(buttonVariants())}>
              Add to LinkedIn
            </a>
            <a href={certificate.linkedInShareUrl} target="_blank" rel="noreferrer noopener" className={cn(buttonVariants({ variant: "outline" }))}>
              Share a post
            </a>
            <a href={`/verify/${certificate.code}/pdf`} download={`${certificate.code}.pdf`} className={cn(buttonVariants({ variant: "outline" }))}>
              Download PDF
            </a>
            <a href={`/verify/${certificate.code}/image`} download={`${certificate.code}.png`} className={cn(buttonVariants({ variant: "outline" }))}>
              Download image
            </a>
          </div>
        ) : null}

        {certificate.evidence.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Capstone work</h2>
            <ul className="divide-y border bg-card text-sm">
              {certificate.evidence.map((item) => (
                <li key={`${item.chapterTitle}-${item.repoUrl}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{item.chapterTitle}</span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <a href={item.repoUrl} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
                      {item.repoUrl.replace("https://github.com/", "")}
                    </a>
                    {item.liveUrl ? (
                      <a href={item.liveUrl} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
                        Live site
                      </a>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-xs leading-5 text-muted-foreground">
          {SITE_NAME} issues and hosts this certificate for {certificate.organization}. Course completion and AI capstone checks were verified.
        </p>
      </div>
    </main>
  );
}
