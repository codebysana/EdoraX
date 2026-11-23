import type { Certificate, Prisma } from "../../generated/prisma/index.js";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import {
  CERTIFICATE_CODE_PATTERN,
  CertificateSettingsSchema,
  LINKEDIN_ISSUER_NAME,
  linkedInAddToProfileUrl,
  linkedInShareUrl,
  type CertificateEligibility,
  type CertificateEvidence,
  certificateTemplateId,
  type ResolvedCertificateSettings,
  type CertificateView,
  type MyCertificateListItem,
  type MyCertificateState,
} from "../../shared/lib/certificates.js";
import { getPlatformCertificateSettings } from "../admin/certificate-settings.js";
import type { PlatformCertificateSettings } from "../../shared/lib/certificates.js";
import type { SessionUser } from "../../types/auth.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../utils/errors.js";
import { requireCourseById } from "../teach/access.js";
import { newCertificateCode } from "./code.js";
import { notifyCertificateIssued } from "../notifications/events.js";
import { logger } from "../../utils/logger.js";

// Certificates are automatic on course completion once every capstone has an AI pass.
// The platform template is stored in AppSetting; issued names and course titles are snapshots.

function courseCode(slug?: string): string {
  return (slug ?? "COURSE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "COURSE";
}

function settingsFor(course: { certificate: Prisma.JsonValue | null; certificateTemplate?: string | null; title?: string; slug?: string; mentor?: { name: string | null } }, platform: PlatformCertificateSettings): ResolvedCertificateSettings | null {
  const parsed = course.certificate ? CertificateSettingsSchema.safeParse(course.certificate) : null;
  if (parsed?.success) return {
    ...parsed.data,
    title: parsed.data.title ?? course.title ?? "Course completion",
    code: parsed.data.code ?? courseCode(course.slug),
    template: certificateTemplateId(course.certificateTemplate ?? parsed.data.template),
    organization: platform.organization,
    program: platform.program,
    issuer: { ...parsed.data.issuer, name: parsed.data.issuer.name ?? platform.issuerName },
    imageData: platform.imageData ?? parsed.data.imageData,
  };
  if (!platform.enabled) return null;
  return { program: platform.program, title: course.title ?? "Course completion", code: courseCode(course.slug), template: certificateTemplateId(course.certificateTemplate), organization: platform.organization, prefix: "ED", issuer: { name: platform.issuerName }, skills: [], imageData: platform.imageData ?? undefined };
}

export function toCertificateView(certificate: Certificate, organization: string, imageData: string | null = null): CertificateView {
  const verifyUrl = `${env.APP_URL}/verify/${certificate.code}`;
  return {
    code: certificate.code,
    template: certificateTemplateId(certificate.template),
    recipientName: certificate.recipientName,
    title: certificate.title,
    program: certificate.program,
    organization,
    issuerName: certificate.issuerName,
    issuerTitle: certificate.issuerTitle,
    skills: certificate.skills,
    issuedAt: certificate.issuedAt.toISOString(),
    revokedAt: certificate.revokedAt?.toISOString() ?? null,
    revokedReason: certificate.revokedAt ? certificate.revokedReason : null,
    evidence: (certificate.evidence as CertificateEvidence[] | null) ?? [],
    verifyUrl,
    imageUrl: `${verifyUrl}/opengraph-image`,
    linkedInAddUrl: linkedInAddToProfileUrl({
      name: certificate.title,
      organizationId: env.CERTIFICATE_LINKEDIN_ORG_ID,
      organizationName: LINKEDIN_ISSUER_NAME,
      issuedAt: certificate.issuedAt,
      certUrl: verifyUrl,
      certId: certificate.code,
    }),
    linkedInShareUrl: linkedInShareUrl(verifyUrl),
    imageData,
  };
}

type EnrollmentForCertificate = {
  id: string;
  userId: string | null;
  courseId: string;
  completedAt: Date | null;
  percentComplete: number;
};

/** Eligibility plus the evidence the certificate will list. */
export async function certificateEligibility(
  enrollment: EnrollmentForCertificate,
  settings: ResolvedCertificateSettings | null
): Promise<CertificateEligibility & { evidence: CertificateEvidence[] }> {
  if (!settings) return { offered: false, eligible: false, missing: [], evidence: [] };
  const missing: string[] = [];
  if (!enrollment.completedAt && enrollment.percentComplete < 100) missing.push("Finish every chapter in the track.");

  const capstones = await prisma.block.findMany({
    where: { type: "CAPSTONE_CHECK", archivedAt: null, chapter: { courseId: enrollment.courseId, archivedAt: null } },
    select: { id: true, chapter: { select: { title: true } } },
    orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
  });
  const evidence: CertificateEvidence[] = [];
  for (const block of capstones) {
    const passed = enrollment.userId
      ? await prisma.capstoneCheck.findFirst({
          where: { blockId: block.id, userId: enrollment.userId, status: "DONE", completed: true },
          orderBy: { createdAt: "desc" },
          select: { repoUrl: true, liveUrl: true, commitSha: true, percent: true },
        })
      : null;
    if (!passed) {
      missing.push(`Pass the AI capstone check in "${block.chapter.title}".`);
      continue;
    }
    evidence.push({
      chapterTitle: block.chapter.title,
      repoUrl: passed.repoUrl,
      liveUrl: passed.liveUrl,
      commitSha: passed.commitSha,
      percent: passed.percent,
    });
  }
  return { offered: true, eligible: missing.length === 0, missing, evidence };
}

async function loadLearnerEnrollment(courseSlug: string, user: SessionUser | undefined) {
  if (!user) throw new UnauthorizedError();
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true, slug: true, title: true, certificate: true, certificateTemplate: true, mentor: { select: { name: true } } },
  });
  if (!course) throw new NotFoundError("Course not found");
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: course.id, userId: user.id } },
    select: { id: true, userId: true, courseId: true, completedAt: true, percentComplete: true, certificate: true },
  });
  if (!enrollment) throw new ForbiddenError("You are not enrolled in this course.");
  const platform = await getPlatformCertificateSettings();
  return { course, enrollment, settings: settingsFor(course, platform), platform };
}

export async function getMyCertificate(courseSlug: string, user: SessionUser | undefined): Promise<MyCertificateState> {
  const loaded = await loadLearnerEnrollment(courseSlug, user);
  const { settings, platform } = loaded;
  let { enrollment } = loaded;
  if (settings) {
    await issueCertificateAutomatically(enrollment.id);
    enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id }, select: { id: true, userId: true, courseId: true, completedAt: true, percentComplete: true, certificate: true } });
  }
  const { evidence: _evidence, ...eligibility } = await certificateEligibility(enrollment, settings);
  const learner = await prisma.user.findUnique({ where: { id: user!.id }, select: { name: true } });
  return {
    eligibility,
    certificate: enrollment.certificate ? toCertificateView(enrollment.certificate, settings?.organization ?? platform.organization, settings?.imageData ?? platform.imageData) : null,
    suggestedName: learner?.name ?? null,
  };
}

const NAME = /^[\p{L}\p{M}][\p{L}\p{M}' .-]{1,79}$/u;

/** Creates the certificate in the background once completion and AI capstone gates are met. */
export async function issueCertificateAutomatically(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { certificate: true, user: { select: { id: true, name: true, email: true } }, course: { select: { id: true, slug: true, title: true, certificate: true, certificateTemplate: true, mentor: { select: { name: true } } } } },
  });
  if (!enrollment?.user || enrollment.certificate || (!enrollment.completedAt && enrollment.percentComplete < 100)) return;
  const platform = await getPlatformCertificateSettings();
  const settings = settingsFor(enrollment.course, platform);
  if (!settings) return;
  const eligibility = await certificateEligibility(enrollment, settings);
  if (!eligibility.eligible) return;
  const candidate = (enrollment.user.name?.trim() || enrollment.user.email.split("@")[0] || "Learner").replace(/\s+/g, " ");
  const recipientName = NAME.test(candidate) ? candidate : "Learner";
  for (let tries = 0; tries < 5; tries++) {
    try {
      const created = await prisma.certificate.create({ data: {
        code: newCertificateCode(settings), userId: enrollment.user.id, courseId: enrollment.course.id,
        enrollmentId: enrollment.id, recipientName, program: settings.program, title: settings.title, template: settings.template,
        issuerName: settings.issuer.name ?? enrollment.course.mentor.name ?? platform.issuerName,
        issuerTitle: settings.issuer.title ?? null, skills: settings.skills,
        evidence: eligibility.evidence as unknown as Prisma.InputJsonValue,
      } });
      // Email only a fresh completion. A certificate backfilled for a course finished long ago (the
      // learner just opened a page) is issued quietly, so nobody gets a burst of old emails. The email
      // must never undo an issued certificate.
      const finishedRecently = !enrollment.completedAt || Date.now() - enrollment.completedAt.getTime() < 24 * 60 * 60 * 1000;
      if (finishedRecently) await notifyCertificateIssued(created).catch((error) => logger.warn({ err: error, certificateId: created.id }, "certificate email failed"));
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
      if (await prisma.certificate.findUnique({ where: { enrollmentId: enrollment.id } })) return;
    }
  }
}

/** Issue once per enrollment. The learner confirms the name exactly as it should appear. */
export async function claimCertificate(courseSlug: string, user: SessionUser | undefined, input: { recipientName: string }): Promise<CertificateView> {
  const { course, enrollment, settings, platform } = await loadLearnerEnrollment(courseSlug, user);
  if (!settings) throw new NotFoundError("This course does not offer a certificate.");
  if (enrollment.certificate) return toCertificateView(enrollment.certificate, settings.organization, settings.imageData ?? platform.imageData);
  const recipientName = input.recipientName.trim().replace(/\s+/g, " ");
  if (!NAME.test(recipientName)) throw new BadRequestError("Write your name as it should appear, using letters, spaces, hyphens or apostrophes.", "CERTIFICATE_NAME");
  const eligibility = await certificateEligibility(enrollment, settings);
  if (!eligibility.eligible) throw new ConflictError(eligibility.missing[0] ?? "This certificate is not ready yet.", "CERTIFICATE_NOT_ELIGIBLE");

  for (let tries = 0; tries < 5; tries++) {
    try {
      const certificate = await prisma.certificate.create({
        data: {
          code: newCertificateCode(settings),
          userId: user!.id,
          courseId: course.id,
          enrollmentId: enrollment.id,
          recipientName,
          program: settings.program,
          title: settings.title,
          template: settings.template,
          // The course's trainer signs unless course.yaml names someone else.
          issuerName: settings.issuer.name ?? course.mentor.name ?? platform.issuerName ?? LINKEDIN_ISSUER_NAME,
          issuerTitle: settings.issuer.title ?? null,
          skills: settings.skills,
          evidence: eligibility.evidence as unknown as Prisma.InputJsonValue,
        },
      });
      await notifyCertificateIssued(certificate).catch((error) => logger.warn({ err: error, certificateId: certificate.id }, "certificate email failed"));
      return toCertificateView(certificate, settings.organization, settings.imageData ?? platform.imageData);
    } catch (error) {
      const code = (error as { code?: string; meta?: { target?: unknown } }).code;
      if (code !== "P2002") throw error;
      // Another tab issued it first: return that one. Otherwise the random code collided; draw again.
      const existing = await prisma.certificate.findUnique({ where: { enrollmentId: enrollment.id } });
      if (existing) return toCertificateView(existing, settings.organization, settings.imageData ?? platform.imageData);
    }
  }
  throw new ConflictError("Could not issue the certificate. Try again.");
}

/** Public, no sign-in. Unknown codes are a plain 404 so ids cannot be probed for details. */
export async function getPublicCertificate(code: string): Promise<CertificateView> {
  if (!CERTIFICATE_CODE_PATTERN.test(code)) throw new NotFoundError("Certificate not found");
  const certificate = await prisma.certificate.findUnique({ where: { code }, include: { course: { select: { certificate: true, certificateTemplate: true, slug: true, title: true } } } });
  if (!certificate) throw new NotFoundError("Certificate not found");
  const platform = await getPlatformCertificateSettings();
  const settings = settingsFor(certificate.course, platform);
  return toCertificateView(certificate, settings?.organization ?? platform.organization, settings?.imageData ?? platform.imageData);
}

/** Mentors of the course and platform admins can revoke, with a reason shown on the verify page. */
export async function revokeCertificate(user: SessionUser, code: string, reason: string): Promise<CertificateView> {
  const certificate = await prisma.certificate.findUnique({ where: { code }, include: { course: { select: { id: true, certificate: true, certificateTemplate: true, slug: true, title: true } } } });
  if (!certificate) throw new NotFoundError("Certificate not found");
  await requireCourseById(user, certificate.course.id, "SUBMISSION_EVALUATOR");
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new BadRequestError("Give a short reason.");
  const updated = await prisma.certificate.update({
    where: { id: certificate.id },
    data: { revokedAt: certificate.revokedAt ?? new Date(), revokedReason: trimmed.slice(0, 500), revokedById: user.id },
  });
  const platform = await getPlatformCertificateSettings();
  const settings = settingsFor(certificate.course, platform);
  return toCertificateView(updated, settings?.organization ?? platform.organization, settings?.imageData ?? platform.imageData);
}

/** Every certificate the signed-in learner has earned, newest first, for the My certificates page. */
export async function listMyCertificates(user: SessionUser | undefined): Promise<MyCertificateListItem[]> {
  if (!user) throw new UnauthorizedError();
  const [rows, platform] = await Promise.all([
    prisma.certificate.findMany({
      where: { userId: user.id },
      orderBy: { issuedAt: "desc" },
      include: { course: { select: { certificate: true, certificateTemplate: true, slug: true, title: true } } },
    }),
    getPlatformCertificateSettings(),
  ]);
  return rows.map((row) => {
    const settings = settingsFor(row.course, platform);
    return { ...toCertificateView(row, settings?.organization ?? platform.organization, settings?.imageData ?? platform.imageData), courseSlug: row.course.slug };
  });
}
