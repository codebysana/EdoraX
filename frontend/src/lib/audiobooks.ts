// Pure helpers for the Audiobooks area: a published book from the API becomes the shape the shelf and
// player use, and the saved listening state becomes progress and a place to resume. No I/O here, so the
// server loader, the player and the tests share one definition.

import { COURSE_CATEGORY_INFO } from "@/lib/course-categories";
import type { CourseCategory } from "@/shared/domain/enums";
import type { PublicAudiobook } from "@/shared/api/audiobooks";

export type AudiobookTrack = {
  /** The chapter's id. Listening progress is saved under it. */
  slug: string;
  title: string;
  minutes: number;
  src: string;
  /** 1-based part and chapter number inside it. Part 0 means the book has no parts: just numbered chapters. */
  part: number;
  chapter: number;
};

export type AudiobookPart = { number: number; title: string | null; firstTrack: number; trackCount: number; minutes: number };

export type Audiobook = {
  slug: string;
  title: string;
  author: string;
  category: CourseCategory;
  subcategory: string | null;
  description: string | null;
  totalMinutes: number;
  tracks: AudiobookTrack[];
  parts: AudiobookPart[];
};

export function categoryLabel(category: CourseCategory): string {
  return COURSE_CATEGORY_INFO.find((info) => info.value === category)?.label ?? "Course";
}

// ---- Listening state ---------------------------------------------------------------

/** Saved per chapter: position and duration in seconds, and whether it was heard to the end. */
export type TrackState = { p: number; d: number; done?: boolean };
/** Saved per book: the chapter heard last, when, and every chapter's state. */
export type BookState = { track: string; at: number; tracks: Record<string, TrackState> };

export type BookListening = {
  started: boolean;
  finished: boolean;
  listenedMinutes: number;
  leftMinutes: number;
  /** 0 to 1. */
  fraction: number;
  doneCount: number;
};

function trackListenedMinutes(track: AudiobookTrack, state: TrackState | undefined): number {
  if (!state) return 0;
  if (state.done) return track.minutes;
  const seconds = state.d > 0 ? Math.min(state.p, state.d) : state.p;
  return Math.min(track.minutes, Math.max(0, seconds) / 60);
}

export function bookListening(book: Pick<Audiobook, "tracks" | "totalMinutes">, state: BookState | undefined): BookListening {
  const listened = book.tracks.reduce((sum, track) => sum + trackListenedMinutes(track, state?.tracks[track.slug]), 0);
  const doneCount = book.tracks.filter((track) => state?.tracks[track.slug]?.done).length;
  const finished = doneCount === book.tracks.length;
  return {
    started: listened > 0 || doneCount > 0,
    finished,
    listenedMinutes: listened,
    leftMinutes: finished ? 0 : Math.max(0, book.totalMinutes - listened),
    fraction: book.totalMinutes > 0 ? Math.min(1, listened / book.totalMinutes) : 0,
    doneCount,
  };
}

/** Where a saved position is worth resuming: not the first seconds, not the last ones. */
export function resumeAt(state: TrackState | undefined): number {
  if (!state || state.done) return 0;
  if (!Number.isFinite(state.p) || state.p <= 3) return 0;
  if (state.d > 0 && state.p >= state.d - 3) return 0;
  return state.p;
}

/**
 * The chapter and second to start from: the chapter heard last, or the next unfinished one after it
 * when it was finished, or the first chapter of a book never opened. `finished` is true when every
 * chapter is done, in which case it starts again from the top.
 */
export function resumeTarget(book: Pick<Audiobook, "tracks">, state: BookState | undefined): { index: number; at: number; finished: boolean } {
  if (!state) return { index: 0, at: 0, finished: false };
  const last = book.tracks.findIndex((track) => track.slug === state.track);
  if (last >= 0 && !state.tracks[state.track]?.done) return { index: last, at: resumeAt(state.tracks[state.track]), finished: false };
  const order = last >= 0 ? [...book.tracks.slice(last + 1), ...book.tracks.slice(0, last)] : book.tracks;
  const next = order.find((track) => !state.tracks[track.slug]?.done);
  if (!next) return { index: 0, at: 0, finished: book.tracks.length > 0 };
  const index = book.tracks.indexOf(next);
  return { index, at: resumeAt(state.tracks[next.slug]), finished: false };
}

/** "Part 2, chapter 3" for a track. */
export function trackLabel(track: Pick<AudiobookTrack, "part" | "chapter">): string {
  return track.part > 0 ? `Part ${track.part}, chapter ${track.chapter}` : `Chapter ${track.chapter}`;
}

/** A published book from the API as the player and shelf use it: one run of chapters, no parts. */
export function audiobookFromApi(book: PublicAudiobook): Audiobook {
  const tracks: AudiobookTrack[] = [...book.tracks]
    .sort((a, b) => a.position - b.position)
    .map((track) => ({ slug: track.id, title: track.title, minutes: track.durationSeconds / 60, src: track.src, part: 0, chapter: track.position }));
  const totalMinutes = tracks.reduce((sum, track) => sum + track.minutes, 0);
  return {
    slug: book.slug,
    title: book.title,
    author: book.authorName,
    category: book.category,
    subcategory: null,
    description: book.description,
    totalMinutes,
    tracks,
    parts: [{ number: 0, title: null, firstTrack: 0, trackCount: tracks.length, minutes: totalMinutes }],
  };
}

// ---- Formatting --------------------------------------------------------------------

/** "45 min", "1 h", "3 h 20 min". Never "0 min". */
export function formatBookLength(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "1:05" or "1:02:09" for the scrubber. */
export function formatPlayerClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Speeds offered in the player, slowest first. */
export const AUDIOBOOK_SPEEDS: readonly number[] = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** Sleep timer choices in minutes; "end" stops at the end of the current chapter. */
export const SLEEP_CHOICES: readonly (number | "end")[] = [5, 15, 30, 45, 60, "end"];

export const SKIP_BACK_SECONDS = 15;
export const SKIP_FORWARD_SECONDS = 30;
