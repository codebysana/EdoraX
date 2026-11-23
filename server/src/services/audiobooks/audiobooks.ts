import { randomBytes } from "node:crypto";
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { prisma } from "../../db/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";
import type { SessionUser } from "../../types/auth.js";
import type { PublicAudiobook, TeachAudiobook } from "../../shared/api/audiobooks.js";
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { isMissingObjectError, r2Storage } from "../storage/r2.js";

// Standalone audiobooks. A book belongs to the instructor who made it (admins can manage any),
// learners only ever see PUBLISHED books, and the audio sits in the private R2 bucket under
// `audiobooks/<bookId>/<trackId>.mp3`, served through the API so unpublishing takes effect at once.

export const MAX_AUDIOBOOK_TRACK_BYTES = 50 * 1024 * 1024;
export const MAX_TRACKS_PER_BOOK = 200;

const bookInclude = { tracks: { orderBy: { position: "asc" } } } satisfies Prisma.AudiobookInclude;
type BookRow = Prisma.AudiobookGetPayload<{ include: typeof bookInclude }>;

function storage(): { client: S3Client; bucket: string } {
  const r2 = r2Storage();
  if (!r2) throw new AppError("Audiobook storage is not configured yet.", 503, "AUDIOBOOK_STORAGE_UNAVAILABLE");
  return r2;
}

const audioKey = (bookId: string, trackId: string) => `audiobooks/${bookId}/${trackId}.mp3`;
export const trackAudioUrl = (slug: string, trackId: string) => `/api/v1/audiobooks/${encodeURIComponent(slug)}/tracks/${trackId}/audio`;

/** True for an MP3 file: an ID3 tag first, or an MPEG audio frame header. */
export function looksLikeMp3(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  if (bytes.toString("ascii", 0, 3) === "ID3") return true;
  return bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0 && (bytes[1]! & 0x06) !== 0;
}

export function slugBase(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "audiobook";
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugBase(title);
  if (!(await prisma.audiobook.findUnique({ where: { slug: base }, select: { id: true } }))) return base;
  return `${base}-${randomBytes(3).toString("hex")}`;
}

function toPublic(book: BookRow): PublicAudiobook {
  return {
    slug: book.slug,
    title: book.title,
    description: book.description,
    authorName: book.authorName,
    category: book.category,
    publishedAt: book.publishedAt?.toISOString() ?? null,
    totalSeconds: book.tracks.reduce((sum, track) => sum + track.durationSeconds, 0),
    tracks: book.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      position: track.position,
      durationSeconds: track.durationSeconds,
      bytes: track.bytes,
      src: trackAudioUrl(book.slug, track.id),
    })),
  };
}

function toTeach(book: BookRow): TeachAudiobook {
  return { ...toPublic(book), id: book.id, status: book.status, createdAt: book.createdAt.toISOString(), updatedAt: book.updatedAt.toISOString() };
}

// ---- Learners ---------------------------------------------------------------------------

export async function listPublishedAudiobooks(): Promise<PublicAudiobook[]> {
  const books = await prisma.audiobook.findMany({
    where: { status: "PUBLISHED", tracks: { some: {} } },
    include: bookInclude,
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
  });
  return books.map(toPublic);
}

export async function getPublishedAudiobook(slug: string): Promise<PublicAudiobook> {
  const book = await prisma.audiobook.findFirst({ where: { slug, status: "PUBLISHED", tracks: { some: {} } }, include: bookInclude });
  if (!book) throw new NotFoundError("Audiobook not found");
  return toPublic(book);
}

export type AudioStream = {
  body: Readable;
  contentType: string;
  /** Present for a range response. */
  contentRange: string | null;
  contentLength: number | null;
  /** The full file size in bytes, from the database. */
  totalBytes: number;
  isPublic: boolean;
};

/**
 * One track's audio. Published books are open to everyone; a draft only to its owner and admins.
 * `range` is the raw Range header, passed to storage so seeking never downloads the whole file.
 */
export async function streamTrackAudio(user: SessionUser | undefined, slug: string, trackId: string, range: string | undefined): Promise<AudioStream> {
  const track = await prisma.audiobookTrack.findFirst({
    where: { id: trackId, audiobook: { slug } },
    select: { id: true, bytes: true, audiobookId: true, audiobook: { select: { status: true, ownerId: true } } },
  });
  if (!track) throw new NotFoundError("Audio not found");
  const published = track.audiobook.status === "PUBLISHED";
  if (!published && !(user && (user.role === "ADMIN" || user.id === track.audiobook.ownerId))) throw new NotFoundError("Audio not found");

  const { client, bucket } = storage();
  try {
    const object = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: audioKey(track.audiobookId, track.id),
      ...(range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {}),
    }));
    if (!object.Body) throw new NotFoundError("Audio not found");
    return {
      body: object.Body as Readable,
      contentType: "audio/mpeg",
      contentRange: object.ContentRange ?? null,
      contentLength: typeof object.ContentLength === "number" ? object.ContentLength : null,
      totalBytes: track.bytes,
      isPublic: published,
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (isMissingObjectError(error)) throw new NotFoundError("Audio not found");
    throw error;
  }
}

// ---- Instructors ------------------------------------------------------------------------

async function requireBook(user: SessionUser, audiobookId: string): Promise<BookRow> {
  const book = await prisma.audiobook.findUnique({ where: { id: audiobookId }, include: bookInclude });
  if (!book) throw new NotFoundError("Audiobook not found");
  if (user.role !== "ADMIN" && book.ownerId !== user.id) throw new ForbiddenError("You do not own this audiobook.", "NOT_AUDIOBOOK_OWNER");
  return book;
}

export async function listTeachAudiobooks(user: SessionUser): Promise<TeachAudiobook[]> {
  const books = await prisma.audiobook.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    include: bookInclude,
    orderBy: { updatedAt: "desc" },
  });
  return books.map(toTeach);
}

export async function getTeachAudiobook(user: SessionUser, audiobookId: string): Promise<TeachAudiobook> {
  return toTeach(await requireBook(user, audiobookId));
}

export async function createAudiobook(
  user: SessionUser,
  input: { title: string; description?: string; authorName?: string; category: "TECH" | "SOFT_SKILLS" | "CLOUD_DEVOPS" },
): Promise<TeachAudiobook> {
  const book = await prisma.audiobook.create({
    data: {
      slug: await uniqueSlug(input.title),
      title: input.title,
      description: input.description || null,
      authorName: input.authorName ?? user.name ?? "Edorax",
      category: input.category,
      ownerId: user.id,
    },
    include: bookInclude,
  });
  return toTeach(book);
}

export async function updateAudiobook(
  user: SessionUser,
  audiobookId: string,
  input: { title?: string; description?: string | null; authorName?: string; category?: "TECH" | "SOFT_SKILLS" | "CLOUD_DEVOPS" },
): Promise<TeachAudiobook> {
  await requireBook(user, audiobookId);
  const book = await prisma.audiobook.update({
    where: { id: audiobookId },
    data: { ...input, ...(input.description !== undefined ? { description: input.description || null } : {}) },
    include: bookInclude,
  });
  return toTeach(book);
}

/** Publishing needs at least one chapter. Unpublishing takes the book off the shelf at once. */
export async function setAudiobookPublished(user: SessionUser, audiobookId: string, published: boolean): Promise<TeachAudiobook> {
  const book = await requireBook(user, audiobookId);
  if (published && book.tracks.length === 0) throw new BadRequestError("Upload at least one chapter before publishing.", "AUDIOBOOK_EMPTY");
  const updated = await prisma.audiobook.update({
    where: { id: audiobookId },
    data: published ? { status: "PUBLISHED", publishedAt: book.publishedAt ?? new Date() } : { status: "DRAFT" },
    include: bookInclude,
  });
  return toTeach(updated);
}

export async function deleteAudiobook(user: SessionUser, audiobookId: string): Promise<void> {
  const book = await requireBook(user, audiobookId);
  // Rows first: once they are gone nothing links to the files, and a leftover file is only wasted space.
  await prisma.audiobook.delete({ where: { id: audiobookId } });
  const r2 = r2Storage();
  if (r2 && book.tracks.length > 0) {
    await r2.client.send(new DeleteObjectsCommand({
      Bucket: r2.bucket,
      Delete: { Objects: book.tracks.map((track) => ({ Key: audioKey(book.id, track.id) })), Quiet: true },
    })).catch(() => undefined);
  }
}

export async function addTrack(user: SessionUser, audiobookId: string, input: { title: string; durationSeconds: number }, bytes: Buffer): Promise<TeachAudiobook> {
  const book = await requireBook(user, audiobookId);
  if (!bytes.length || bytes.length > MAX_AUDIOBOOK_TRACK_BYTES) throw new BadRequestError("Choose an MP3 file smaller than 50 MB.", "INVALID_AUDIO_SIZE");
  if (!looksLikeMp3(bytes)) throw new BadRequestError("Use an MP3 file.", "UNSUPPORTED_AUDIO");
  if (book.tracks.length >= MAX_TRACKS_PER_BOOK) throw new ConflictError(`A book can have at most ${MAX_TRACKS_PER_BOOK} chapters.`);
  const { client, bucket } = storage();

  const track = await createTrackRow(audiobookId, input, bytes.length);
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: audioKey(audiobookId, track.id), Body: bytes, ContentType: "audio/mpeg" }));
  } catch (error) {
    await prisma.audiobookTrack.delete({ where: { id: track.id } }).catch(() => undefined);
    throw error;
  }
  return toTeach(await requireBook(user, audiobookId));
}

/** Takes the next free position; retries when two uploads race for the same one. */
async function createTrackRow(audiobookId: string, input: { title: string; durationSeconds: number }, bytes: number) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const last = await prisma.audiobookTrack.aggregate({ where: { audiobookId }, _max: { position: true } });
    try {
      return await prisma.audiobookTrack.create({
        data: { audiobookId, title: input.title, position: (last._max.position ?? 0) + 1, durationSeconds: Math.max(1, Math.round(input.durationSeconds)), bytes },
      });
    } catch (error) {
      if (!(error instanceof Error) || (error as { code?: string }).code !== "P2002") throw error;
    }
  }
  throw new ConflictError("Another upload is in progress. Try again.");
}

export async function renameTrack(user: SessionUser, audiobookId: string, trackId: string, title: string): Promise<TeachAudiobook> {
  await requireBook(user, audiobookId);
  const result = await prisma.audiobookTrack.updateMany({ where: { id: trackId, audiobookId }, data: { title } });
  if (result.count === 0) throw new NotFoundError("Chapter not found");
  return toTeach(await requireBook(user, audiobookId));
}

export async function removeTrack(user: SessionUser, audiobookId: string, trackId: string): Promise<TeachAudiobook> {
  const book = await requireBook(user, audiobookId);
  if (!book.tracks.some((track) => track.id === trackId)) throw new NotFoundError("Chapter not found");
  await prisma.$transaction(async (tx) => {
    await tx.audiobookTrack.delete({ where: { id: trackId } });
    const rest = book.tracks.filter((track) => track.id !== trackId);
    // Close the gap, going up so the unique (book, position) pair is never taken twice.
    for (const [index, track] of rest.entries()) {
      if (track.position !== index + 1) await tx.audiobookTrack.update({ where: { id: track.id }, data: { position: index + 1 } });
    }
    // A published book with no chapters would be an empty shelf entry.
    if (rest.length === 0 && book.status === "PUBLISHED") await tx.audiobook.update({ where: { id: audiobookId }, data: { status: "DRAFT" } });
  });
  const r2 = r2Storage();
  await r2?.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: audioKey(audiobookId, trackId) })).catch(() => undefined);
  return toTeach(await requireBook(user, audiobookId));
}

export async function reorderTracks(user: SessionUser, audiobookId: string, trackIds: string[]): Promise<TeachAudiobook> {
  const book = await requireBook(user, audiobookId);
  const known = new Set(book.tracks.map((track) => track.id));
  if (trackIds.length !== known.size || new Set(trackIds).size !== trackIds.length || !trackIds.every((trackId) => known.has(trackId))) {
    throw new BadRequestError("Send every chapter of the book exactly once.", "INVALID_TRACK_ORDER");
  }
  await prisma.$transaction(async (tx) => {
    // Park positions out of the way first, because (book, position) is unique.
    const offset = book.tracks.length + 1;
    for (const track of book.tracks) await tx.audiobookTrack.update({ where: { id: track.id }, data: { position: track.position + offset } });
    for (const [index, trackId] of trackIds.entries()) await tx.audiobookTrack.update({ where: { id: trackId }, data: { position: index + 1 } });
  });
  return toTeach(await requireBook(user, audiobookId));
}
