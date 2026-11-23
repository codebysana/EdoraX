import { describe, expect, it } from "vitest";
import { highlightsToMarkdown } from "@buildment/learning-ui/components/learn/highlights-library-view";
import type { UserHighlightView } from "@buildment/learning-ui/components/learn/highlight-types";

const row = (over: Partial<UserHighlightView>): UserHighlightView => ({
  id: "1",
  color: "YELLOW",
  quote: "a quote",
  prefix: null,
  suffix: null,
  occurrence: 0,
  note: null,
  chapterId: "c1",
  chapterTitle: "Chapter one",
  chapterSlug: "chapter-one",
  courseSlug: "course",
  courseTitle: "Course",
  ...over,
});

describe("highlightsToMarkdown", () => {
  it("groups by course and chapter and puts each note under its quote", () => {
    const text = highlightsToMarkdown([
      row({ id: "1", quote: "first", note: "My note" }),
      row({ id: "2", quote: "second" }),
      row({ id: "3", quote: "other", chapterId: "c2", chapterTitle: "Chapter two" }),
    ]);
    expect(text).toBe(
      [
        "# My highlights and notes",
        "",
        "## Course",
        "",
        "### Chapter one",
        "",
        "> first",
        "",
        "**Note:** My note",
        "",
        "> second",
        "",
        "### Chapter two",
        "",
        "> other",
        "",
      ].join("\n"),
    );
  });

  it("keeps multi-line quotes and notes inside the quote block", () => {
    const text = highlightsToMarkdown([row({ quote: "line one\nline two", note: "note one\nnote two" })]);
    expect(text).toContain("> line one\n> line two");
    expect(text).toContain("**Note:** note one\n> note two");
  });
});
