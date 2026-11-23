import { ImageResponse } from "next/og";
import { qrModules } from "@/lib/qr";
import { CERTIFICATE_TEMPLATE_IDS, type CertificateView } from "@/shared/lib/certificates";
import { CERTIFICATE_SIZE, CertificateArtwork } from "@/app/verify/[code]/certificate-artwork";
import { loadCertificateFonts } from "@/app/verify/[code]/certificate-fonts";

// A sample certificate in one design, for the instructor's template picker. It uses made-up
// details and takes no input, so only a few images exist and the CDN can keep them. Nothing is saved.

export async function GET(request: Request, { params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  // The home page shows a filled-in sample with no trainer name; the template picker shows placeholders.
  const home = new URL(request.url).searchParams.get("sample") === "home";
  if (!(CERTIFICATE_TEMPLATE_IDS as string[]).includes(template)) return new Response("Unknown template", { status: 404 });

  const certificate: CertificateView = {
    code: "ED-SAMPLE-A1B2C3D4",
    template: template as CertificateView["template"],
    recipientName: "Alex Learner",
    title: home ? "System Design, Hands On: Build It, Break It, Explain It" : "Your Course Title",
    program: "Edorax Learning",
    organization: "Edorax",
    issuerName: home ? "" : "Your Name",
    issuerTitle: null,
    skills: [],
    issuedAt: new Date().toISOString(),
    revokedAt: null,
    revokedReason: null,
    evidence: home ? [{ chapterTitle: "Capstone", repoUrl: "https://github.com/", liveUrl: null, commitSha: null, percent: 100 }] : [],
    verifyUrl: "https://edorax.com/verify/ED-SAMPLE-A1B2C3D4",
    imageUrl: "",
    linkedInAddUrl: "",
    linkedInShareUrl: "",
    imageData: null,
  };

  const fonts = await loadCertificateFonts();
  const response = new ImageResponse(<CertificateArtwork certificate={certificate} qr={qrModules(certificate.verifyUrl)} />, { ...CERTIFICATE_SIZE, fonts: fonts.length ? fonts : undefined });
  response.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  return response;
}
