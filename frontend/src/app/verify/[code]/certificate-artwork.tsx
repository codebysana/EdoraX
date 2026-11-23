import type { CertificateView } from "@/shared/lib/certificates";
import { ClassicTemplate } from "./templates/classic";
import { EdoraxTemplate } from "./templates/edorax";
import { MinimalTemplate } from "./templates/minimal";
import { VerifiedTemplate } from "./templates/verified";

// The certificate itself, drawn at 1536 x 1024. A course picks a design with `template` in its
// certificate settings and the choice is saved on each certificate when it is issued, so a later
// change never restyles an old one. To add a design: write a component in ./templates that takes
// TemplateProps, add it here, and add its id to CERTIFICATE_TEMPLATES in shared/lib/certificates.ts.
//
// Templates are written for Satori (the engine behind ImageResponse): every box is flex, text sits
// in its own box and art is inline SVG. render-certificate.tsx renders the result to a PNG, which the
// verify page shows and offers as the PNG and PDF download, so all of them are the same document.

export const CERTIFICATE_SIZE = { width: 1536, height: 1024 };

const TEMPLATES = {
  verified: VerifiedTemplate,
  edorax: EdoraxTemplate,
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
} as const;

export function CertificateArtwork({ certificate, qr }: { certificate: CertificateView; qr?: boolean[][] | null }) {
  const Template = TEMPLATES[certificate.template] ?? VerifiedTemplate;
  return <Template certificate={certificate} qr={qr} />;
}
