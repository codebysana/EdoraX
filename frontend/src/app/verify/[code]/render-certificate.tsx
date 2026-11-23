import "server-only";
import { ImageResponse } from "next/og";
import { qrModules } from "@/lib/qr";
import { loadCertificate } from "./certificate-data";
import { loadCertificateFonts } from "./certificate-fonts";
import { CERTIFICATE_SIZE, CertificateArtwork } from "./certificate-artwork";

/** The certificate as a PNG, or null for an unknown code. Every caller (page, download, PDF, link preview) uses this. */
export async function renderCertificateImage(code: string): Promise<ImageResponse | null> {
  const certificate = await loadCertificate(code);
  if (!certificate) return null;

  const fonts = await loadCertificateFonts();
  // The QR code holds the full verify link, so a phone camera opens the page that proves the certificate.
  const qr = (() => { try { return qrModules(certificate.verifyUrl); } catch { return null; } })();
  return new ImageResponse(<CertificateArtwork certificate={certificate} qr={qr} />, { ...CERTIFICATE_SIZE, fonts: fonts.length ? fonts : undefined });
}
