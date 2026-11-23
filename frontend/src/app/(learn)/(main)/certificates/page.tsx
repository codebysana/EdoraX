import type { Metadata } from "next";
import Link from "next/link";
import { Award, Download, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireLearnSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import type { CertificateView } from "@/shared/lib/certificates";

export const metadata: Metadata = { title: "Certificates" };

function issuedOn(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function CertificatesPage() {
  await requireLearnSurface();
  const { certificates } = await serverApiFetch<{ certificates: CertificateView[] }>("/api/v1/certificates/mine");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="text-[32px] leading-tight tracking-[-0.035em] sm:text-[40px]">Certificates</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">Every certificate you have earned. Share the link, add it to LinkedIn or download it as a PDF.</p>
      </header>

      {certificates.length > 0 ? (
        <ul className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {certificates.map((certificate) => (
            <li key={certificate.code} className="overflow-hidden rounded-2xl border bg-card">
              <Link href={`/verify/${certificate.code}`} className="block border-b bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/verify/${certificate.code}/image`}
                  alt={`Certificate for ${certificate.title}, issued to ${certificate.recipientName}`}
                  width={1536}
                  height={1024}
                  loading="lazy"
                  className="block h-auto w-full"
                />
              </Link>
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="font-semibold">{certificate.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {certificate.revokedAt ? `Withdrawn on ${issuedOn(certificate.revokedAt)}` : `Issued ${issuedOn(certificate.issuedAt)}`} · {certificate.code}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/verify/${certificate.code}`} className={cn(buttonVariants({ size: "sm" }), "min-h-10")}>
                    <Award aria-hidden /> View
                  </Link>
                  {!certificate.revokedAt ? (
                    <>
                      <a href={`/verify/${certificate.code}/pdf`} download={`${certificate.code}.pdf`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "min-h-10")}>
                        <Download aria-hidden /> Download PDF
                      </a>
                      <a href={certificate.linkedInAddUrl} target="_blank" rel="noreferrer noopener" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "min-h-10")}>
                        <ExternalLink aria-hidden /> Add to LinkedIn
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 flex flex-col items-center border border-border bg-card px-6 py-14 text-center">
          <Award className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-xl tracking-[-0.02em]">No certificates yet</h2>
          <p className="mt-2 max-w-sm text-base text-muted-foreground">Finish every chapter of a course and your certificate appears here.</p>
          <Link href="/my-courses" className={buttonVariants({ className: "mt-6" })}>Go to My learning</Link>
        </div>
      )}
    </div>
  );
}
