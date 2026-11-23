import { describe, expect, it } from "vitest";
import {
  audiobookFromApi,
  bookListening,
  formatBookLength,
  formatPlayerClock,
  resumeTarget,
  trackLabel,
  type BookState,
} from "../../../src/lib/audiobooks";
import type { PublicAudiobook } from "../../../src/shared/api/audiobooks";
import { coverPalette, coverSvg, layoutTitle } from "../../../src/lib/audiobook-cover";
import { COURSE_CATEGORY_INFO, categoryFromParam } from "../../../src/lib/course-categories";
import { COURSE_CATEGORIES } from "../../../src/shared/domain/enums";

const API_BOOK: PublicAudiobook = {
  slug: "collaboration",
  title: "Collaboration",
  description: "Working well with others.",
  authorName: "Aisha Khan",
  category: "SOFT_SKILLS",
  publishedAt: "2026-11-01T00:00:00.000Z",
  totalSeconds: 450,
  tracks: [
    { id: "2-1-set-the-scene", title: "Set the scene", position: 3, durationSeconds: 120, bytes: 1, src: "/api/v1/audiobooks/collaboration/tracks/2-1-set-the-scene/audio" },
    { id: "1-2-roles-and-expectations", title: "Roles and expectations", position: 1, durationSeconds: 240, bytes: 1, src: "/api/v1/audiobooks/collaboration/tracks/1-2-roles-and-expectations/audio" },
    { id: "1-10-wrap-up", title: "Wrap up", position: 2, durationSeconds: 90, bytes: 1, src: "/api/v1/audiobooks/collaboration/tracks/1-10-wrap-up/audio" },
  ],
};

describe("audiobookFromApi", () => {
  const book = audiobookFromApi(API_BOOK);

  it("keeps chapters in book order, as numbered chapters without parts", () => {
    expect(book.tracks.map((t) => [t.title, t.chapter, t.part])).toEqual([
      ["Roles and expectations", 1, 0],
      ["Wrap up", 2, 0],
      ["Set the scene", 3, 0],
    ]);
    expect(book.parts).toEqual([{ number: 0, title: null, firstTrack: 0, trackCount: 3, minutes: 7.5 }]);
    expect(book.totalMinutes).toBe(7.5);
  });

  it("carries the author, category and audio address through", () => {
    expect(book).toMatchObject({ slug: "collaboration", author: "Aisha Khan", category: "SOFT_SKILLS", subcategory: null, description: "Working well with others." });
    expect(book.tracks[0]!.src).toBe("/api/v1/audiobooks/collaboration/tracks/1-2-roles-and-expectations/audio");
  });

  it("labels a chapter without a part number", () => {
    expect(trackLabel(book.tracks[1]!)).toBe("Chapter 2");
    expect(trackLabel({ part: 2, chapter: 3 })).toBe("Part 2, chapter 3");
  });
});

describe("listening progress", () => {
  const book = audiobookFromApi(API_BOOK);

  it("starts a new book at chapter one", () => {
    expect(resumeTarget(book, undefined)).toEqual({ index: 0, at: 0, finished: false });
    expect(bookListening(book, undefined)).toMatchObject({ started: false, fraction: 0, leftMinutes: 7.5 });
  });

  it("resumes the chapter heard last, mid-way", () => {
    const state: BookState = {
      track: "1-10-wrap-up",
      at: 1,
      tracks: { "1-2-roles-and-expectations": { p: 240, d: 240, done: true }, "1-10-wrap-up": { p: 30, d: 90 } },
    };
    expect(resumeTarget(book, state)).toEqual({ index: 1, at: 30, finished: false });
    const listening = bookListening(book, state);
    expect(listening.listenedMinutes).toBeCloseTo(4.5);
    expect(listening.leftMinutes).toBeCloseTo(3);
    expect(listening.doneCount).toBe(1);
  });

  it("moves on to the next unfinished chapter once the last one was finished", () => {
    const state: BookState = { track: "1-10-wrap-up", at: 1, tracks: { "1-10-wrap-up": { p: 90, d: 90, done: true } } };
    expect(resumeTarget(book, state)).toEqual({ index: 2, at: 0, finished: false });
  });

  it("starts again from the top when every chapter is done", () => {
    const tracks = Object.fromEntries(book.tracks.map((t) => [t.slug, { p: 1, d: 1, done: true }]));
    const state: BookState = { track: "2-1-set-the-scene", at: 1, tracks };
    expect(resumeTarget(book, state)).toEqual({ index: 0, at: 0, finished: true });
    expect(bookListening(book, state)).toMatchObject({ finished: true, leftMinutes: 0, fraction: 1 });
  });

  it("ignores a position in the first or last seconds", () => {
    const state: BookState = { track: "1-2-roles-and-expectations", at: 1, tracks: { "1-2-roles-and-expectations": { p: 2, d: 240 } } };
    expect(resumeTarget(book, state).at).toBe(0);
    state.tracks["1-2-roles-and-expectations"] = { p: 238.5, d: 240 };
    expect(resumeTarget(book, state).at).toBe(0);
  });
});

describe("formatting", () => {
  it("writes book lengths and clocks", () => {
    expect(formatBookLength(0.2)).toBe("1 min");
    expect(formatBookLength(45)).toBe("45 min");
    expect(formatBookLength(60)).toBe("1 h");
    expect(formatBookLength(200)).toBe("3 h 20 min");
    expect(formatPlayerClock(65)).toBe("1:05");
    expect(formatPlayerClock(3729)).toBe("1:02:09");
    expect(formatPlayerClock(Number.NaN)).toBe("0:00");
  });
});

describe("covers", () => {
  it("wraps long titles into at most four lines without breaking words", () => {
    const { lines } = layoutTitle("Collaboration, Feedback & Conflict Resolution");
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.join(" ")).toBe("Collaboration, Feedback & Conflict Resolution");
  });

  it("is the same for the same course and escapes text", () => {
    const input = { slug: "collaboration", title: "A <b> & C", author: "Zeeshan Adil", label: "Teamwork & Collaboration" };
    expect(coverSvg(input)).toBe(coverSvg(input));
    expect(coverSvg(input)).toContain("&lt;b&gt;");
    expect(coverSvg(input)).toContain("TEAMWORK &amp; COLLABORATION");
    expect(coverSvg(input)).not.toContain("<b>");
    expect(coverPalette("collaboration")).toEqual(coverPalette("collaboration"));
  });
});

describe("course categories", () => {
  it("has a shelf for every category, Cloud and DevOps included", () => {
    expect(COURSE_CATEGORY_INFO.map((c) => c.value).sort()).toEqual([...COURSE_CATEGORIES].sort());
    expect(categoryFromParam("cloud-devops")).toBe("CLOUD_DEVOPS");
  });
});
