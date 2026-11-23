import { ImageResponse } from "next/og";
import { CERTIFICATE_SIZE } from "./certificate-artwork";
import { renderCertificateImage } from "./render-certificate";

// The link preview image (og:image). The page and the downloads use the cached /image route
// instead, but they draw the same certificate (see render-certificate.tsx).

export const size = CERTIFICATE_SIZE;
export const contentType = "image/png";
export const alt = "Certificate of completion";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const image = await renderCertificateImage(code);
  if (image) return image;
  return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#fff", alignItems: "center", justifyContent: "center", fontSize: 56, color: "#0A1240" }}>Certificate not found</div>, size);
}
