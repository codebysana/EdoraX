import { NextResponse } from "next/server";
import { pngToPdf } from "@/lib/png-to-pdf";
import { loadCertificate } from "../certificate-data";
import { renderCertificateImage } from "../render-certificate";

// The certificate as a PDF. The page is the same PNG the verify page shows, wrapped in one page.

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const certificate = await loadCertificate(code);
  if (!certificate) return new NextResponse("Certificate not found", { status: 404 });
  // The verify page hides the button for a withdrawn certificate; the file must not be served either.
  if (certificate.revokedAt) return new NextResponse("This certificate was withdrawn", { status: 410 });

  const image = await renderCertificateImage(code);
  if (!image) return new NextResponse("Certificate not found", { status: 404 });
  const png = Buffer.from(await image.arrayBuffer());
  const pdf = pngToPdf(png, `Certificate ${certificate.code}`);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificate.code}.pdf"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
