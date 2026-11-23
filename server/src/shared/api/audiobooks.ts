import type { CourseCategory } from "../domain/enums.js";

// Wire contract for audiobooks: standalone books that instructors upload and learners listen to.

export type AudiobookStatusValue = "DRAFT" | "PUBLISHED";

export type AudiobookTrackSummary = {
  id: string;
  title: string;
  /** 1-based order inside the book. */
  position: number;
  durationSeconds: number;
  bytes: number;
  /** Same-origin URL of the audio. Supports range requests. */
  src: string;
};

/** A published book, as learners see it. */
export type PublicAudiobook = {
  slug: string;
  title: string;
  description: string | null;
  authorName: string;
  category: CourseCategory;
  publishedAt: string | null;
  totalSeconds: number;
  tracks: AudiobookTrackSummary[];
};

/** A book in the instructor workspace: drafts included. */
export type TeachAudiobook = PublicAudiobook & {
  id: string;
  status: AudiobookStatusValue;
  createdAt: string;
  updatedAt: string;
};

export type AudiobookListResponse = { audiobooks: PublicAudiobook[] };
export type TeachAudiobookListResponse = { audiobooks: TeachAudiobook[] };
