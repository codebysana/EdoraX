import { z } from "zod";

// Completion certificates (docs/16-capstone-checker-and-certificates.mdx). A course opts in
// with a `certificate` block in course.yaml; the API issues one per passed enrollment and
// the public page /verify/<code> shows it to anyone.

/** The certificate designs an instructor can pick. "verified" is the default and matches the Edorax brand. */
export const CERTIFICATE_TEMPLATES = [
  { id: "verified", label: "Edorax brand", description: "Paper and cobalt, with Dot and a verify panel. The default." },
  { id: "edorax", label: "Edorax blue", description: "Blue and white with a seal." },
  { id: "classic", label: "Classic", description: "Cream paper, gold double border and serif type." },
  { id: "minimal", label: "Minimal", description: "Clean white page with large type." },
] as const;
export type CertificateTemplateId = (typeof CERTIFICATE_TEMPLATES)[number]["id"];
export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplateId = "verified";
export const CERTIFICATE_TEMPLATE_IDS = CERTIFICATE_TEMPLATES.map((template) => template.id) as [CertificateTemplateId, ...CertificateTemplateId[]];
const TEMPLATE_IDS = CERTIFICATE_TEMPLATE_IDS;

export function certificateTemplateId(value: unknown): CertificateTemplateId {
  return TEMPLATE_IDS.find((id) => id === value) ?? DEFAULT_CERTIFICATE_TEMPLATE;
}

export const CertificateSettingsSchema = z
  .object({
    /** The programme line, for example "Dev Weekends Mentorship". */
    program: z.string().trim().min(1).max(120).default("Dev Weekends Mentorship"),
    /** The track title on the certificate and in LinkedIn's Name field. Defaults to the course title. */
    title: z.string().trim().min(1).max(120).optional(),
    /** Short track code used in the public id, for example L2 in DW-L2-7K3F9QXM. Defaults to one made from the course slug. */
    code: z.string().regex(/^[A-Z0-9]{1,6}$/, "Use 1 to 6 capital letters or digits").optional(),
    /** Which design the certificate uses. Defaults to "verified". */
    template: z.enum(TEMPLATE_IDS).optional(),
    /** The programme's organisation, shown on the certificate. LinkedIn's issuer is always Edorax. */
    organization: z.string().trim().min(1).max(120).default("Dev Weekends"),
    /** Prefix of the public id. */
    prefix: z.string().regex(/^[A-Z]{2,4}$/).default("DW"),
    /**
     * Who signs the certificate. Leave the name out to use the course's trainer, the instructor
     * name the catalog shows for the course.
     */
    issuer: z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        title: z.string().trim().min(1).max(120).optional(),
      })
      .strict()
      .default({}),
    skills: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
    /** Optional course-specific override; platform admins manage the default artwork. */
    imageData: z.string().max(970_000).optional(),
  })
  .strict();

export const PlatformCertificateSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  program: z.string().trim().min(1).max(120).default("Edorax Learning"),
  organization: z.string().trim().min(1).max(120).default("Edorax"),
  issuerName: z.string().trim().min(1).max(120).default("Edorax"),
  imageData: z.string().max(970_000).nullable().default(null),
}).strict();

export type PlatformCertificateSettings = z.infer<typeof PlatformCertificateSettingsSchema>;

export type CertificateSettings = z.infer<typeof CertificateSettingsSchema>;

/** Settings with every default filled in, which is what issuing a certificate needs. */
export type ResolvedCertificateSettings = Omit<CertificateSettings, "title" | "code" | "template"> & {
  title: string;
  code: string;
  template: CertificateTemplateId;
};

export type CertificateEvidence = {
  chapterTitle: string;
  repoUrl: string;
  liveUrl: string | null;
  commitSha: string | null;
  percent: number | null;
};

export type CertificateView = {
  code: string;
  template: CertificateTemplateId;
  recipientName: string;
  title: string;
  program: string;
  organization: string;
  issuerName: string;
  issuerTitle: string | null;
  skills: string[];
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  evidence: CertificateEvidence[];
  verifyUrl: string;
  imageUrl: string;
  linkedInAddUrl: string;
  linkedInShareUrl: string;
  imageData: string | null;
};

/** A certificate in the learner's own list, with the course it belongs to. */
export type MyCertificateListItem = CertificateView & { courseSlug: string };

/** The organisation LinkedIn lists as the issuer: the platform that issues and verifies certificates. */
export const LINKEDIN_ISSUER_NAME = "Edorax";

export type CertificateEligibility = {
  /** False when the course has no certificate block. */
  offered: boolean;
  eligible: boolean;
  /** What is still needed, in plain words. */
  missing: string[];
};

export type MyCertificateState = {
  eligibility: CertificateEligibility;
  certificate: CertificateView | null;
  suggestedName: string | null;
};

/** Crockford base32 without I, L, O, U: easy to read aloud and type. */
export const CERTIFICATE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CERTIFICATE_CODE_PATTERN = /^[A-Z]{2,4}-[A-Z0-9]{1,6}-[0-9A-HJKMNP-TV-Z]{8}$/;

/**
 * LinkedIn's Add to profile form, pre-filled as a Licence or certification.
 * With an organisation id LinkedIn links the issuer page; without it the name is free text.
 */
export function linkedInAddToProfileUrl(input: {
  name: string;
  organizationId?: string | null;
  organizationName: string;
  issuedAt: Date;
  certUrl: string;
  certId: string;
}): string {
  const params = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: input.name });
  if (input.organizationId) params.set("organizationId", input.organizationId);
  else params.set("organizationName", input.organizationName);
  params.set("issueYear", String(input.issuedAt.getUTCFullYear()));
  params.set("issueMonth", String(input.issuedAt.getUTCMonth() + 1));
  params.set("certUrl", input.certUrl);
  params.set("certId", input.certId);
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/** LinkedIn's share dialog for a post with the verify link; the page's Open Graph image shows. */
export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url }).toString()}`;
}
