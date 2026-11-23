import type { CertificateView } from "@/shared/lib/certificates";

export type TemplateProps = { certificate: CertificateView; qr?: boolean[][] | null };
