import { NextResponse } from "next/server";
import { renderCertificateImage } from "../render-certificate";

// The certificate PNG the verify page, My certificates and "Download image" use. Drawing it costs
// CPU, so browsers and a CDN may reuse it for five minutes. A withdrawn certificate shows its
// stamp once the cache expires.

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const image = await renderCertificateImage(code);
  if (!image) return new NextResponse("Certificate not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  image.headers.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=60");
  return image;
}
