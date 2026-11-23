import { prisma } from "../../db/prisma.js";
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from "../../utils/errors.js";
import type { SessionUser } from "../../types/auth.js";
import type { HighlightColor } from "../../generated/prisma/index.js";
import { requireBlockSubmissionAccess } from "../enrollment/api-learn-access.js";
import { releaseContainsChapter } from "../courses/releases.js";
import { ensureChapterStarted } from "../progress/compute.js";

/** Highest number of highlights one learner can keep across all chapters. */
export const MAX_HIGHLIGHTS_PER_USER = 2000;

export type HighlightView = {
  id: string;
  color: HighlightColor;
  quote: string;
  prefix: string | null;
  suffix: string | null;
  occurrence: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserHighlightView = HighlightView & {
  chapterId: string;
  chapterTitle: string;
  chapterSlug: string;
  courseSlug: string;
  courseTitle: string;
};

/** Read access gate reused for every highlight operation on a chapter. */
async function chapterAccess(user: SessionUser, chapterId: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId, archivedAt: null },
    select: { id: true, courseId: true, course: { select: { familySlug: true } } },
  });
  if (!chapter) throw new NotFoundError("Chapter not found.");
  const enrollment = await requireBlockSubmissionAccess(chapter.courseId, user);
  if (!(await releaseContainsChapter(chapter.courseId, enrollment, chapter.course.familySlug, chapter.id))) {
    throw new NotFoundError("Chapter not found.");
  }
  return { chapter, enrollment };
}

export async function listChapterHighlights(user: SessionUser, chapterId: string): Promise<HighlightView[]> {
  const { chapter } = await chapterAccess(user, chapterId);
  const rows = await prisma.chapterHighlight.findMany({
    where: { userId: user.id, chapterId: chapter.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, color: true, quote: true, prefix: true, suffix: true, occurrence: true, note: true,
      createdAt: true, updatedAt: true,
    },
  });
  return rows.map(toView);
}

export async function createChapterHighlight(
  user: SessionUser,
  input: {
    chapterId: string;
    color?: HighlightColor;
    quote: string;
    prefix?: string | null;
    suffix?: string | null;
    occurrence?: number;
    note?: string | null;
  }
): Promise<HighlightView> {
  const { chapter, enrollment } = await chapterAccess(user, input.chapterId);
  const quote = input.quote.trim();
  if (!quote) throw new BadRequestError("Highlight text is required.");
  const occurrence = input.occurrence ?? 0;
  const exists = () => new ConflictError("This text is already highlighted.", "HIGHLIGHT_EXISTS");
  const duplicate = await prisma.chapterHighlight.findFirst({
    where: { userId: user.id, chapterId: chapter.id, quote, occurrence },
    select: { id: true },
  });
  if (duplicate) throw exists();
  const count = await prisma.chapterHighlight.count({ where: { userId: user.id } });
  if (count >= MAX_HIGHLIGHTS_PER_USER) {
    throw new ConflictError(
      `You have reached the limit of ${MAX_HIGHLIGHTS_PER_USER} highlights. Delete some to add more.`,
      "HIGHLIGHT_LIMIT_REACHED"
    );
  }
  try {
    const row = await prisma.$transaction(async (tx) => {
      await ensureChapterStarted(tx, enrollment.id, chapter.id);
      return tx.chapterHighlight.create({
        data: {
          userId: user.id,
          enrollmentId: enrollment.id,
          chapterId: chapter.id,
          color: input.color ?? "YELLOW",
          quote,
          prefix: input.prefix?.trim() || null,
          suffix: input.suffix?.trim() || null,
          occurrence,
          note: input.note?.trim() || null,
        },
        select: {
          id: true, color: true, quote: true, prefix: true, suffix: true, occurrence: true, note: true,
          createdAt: true, updatedAt: true,
        },
      });
    });
    return toView(row);
  } catch (error) {
    // Two parallel requests can both pass the check above; the unique index decides.
    if ((error as { code?: string }).code === "P2002") throw exists();
    throw error;
  }
}

export async function updateChapterHighlight(
  user: SessionUser,
  highlightId: string,
  input: { color?: HighlightColor; note?: string | null }
): Promise<HighlightView> {
  const existing = await prisma.chapterHighlight.findUnique({ where: { id: highlightId }, select: { id: true, userId: true } });
  if (!existing) throw new NotFoundError("Highlight not found.");
  if (existing.userId !== user.id) throw new ForbiddenError("You cannot edit someone else's highlight.");
  const row = await prisma.chapterHighlight.update({
    where: { id: highlightId },
    data: {
      ...(input.color ? { color: input.color } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
    },
    select: {
      id: true, color: true, quote: true, prefix: true, suffix: true, occurrence: true, note: true,
      createdAt: true, updatedAt: true,
    },
  });
  return toView(row);
}

export async function deleteChapterHighlight(user: SessionUser, highlightId: string): Promise<void> {
  const existing = await prisma.chapterHighlight.findUnique({ where: { id: highlightId }, select: { id: true, userId: true } });
  if (!existing) throw new NotFoundError("Highlight not found.");
  if (existing.userId !== user.id) throw new ForbiddenError("You cannot delete someone else's highlight.");
  await prisma.chapterHighlight.delete({ where: { id: highlightId } });
}

export async function listUserHighlights(user: SessionUser): Promise<UserHighlightView[]> {
  const rows = await prisma.chapterHighlight.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, color: true, quote: true, prefix: true, suffix: true, occurrence: true, note: true,
      createdAt: true, updatedAt: true,
      chapter: { select: { id: true, title: true, slug: true, course: { select: { slug: true, title: true } } } },
    },
  });
  return rows.map((row) => ({
    ...toView(row),
    chapterId: row.chapter.id,
    chapterTitle: row.chapter.title,
    chapterSlug: row.chapter.slug,
    courseSlug: row.chapter.course.slug,
    courseTitle: row.chapter.course.title,
  }));
}

function toView(row: {
  id: string;
  color: HighlightColor;
  quote: string;
  prefix: string | null;
  suffix: string | null;
  occurrence: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): HighlightView {
  return {
    id: row.id,
    color: row.color,
    quote: row.quote,
    prefix: row.prefix,
    suffix: row.suffix,
    occurrence: row.occurrence,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
