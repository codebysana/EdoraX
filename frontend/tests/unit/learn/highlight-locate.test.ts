import { describe, expect, it } from "vitest";
import { locateQuote, type HighlightAnchor } from "@/lib/highlight-locate";

const anchor = (over: Partial<HighlightAnchor> & { quote: string }): HighlightAnchor => ({
  prefix: null,
  suffix: null,
  occurrence: 0,
  ...over,
});

describe("locateQuote", () => {
  const original = "Intro text. Use a queue here. Later, use a queue for jobs. The end.";

  it("uses the occurrence number when no context was saved", () => {
    expect(locateQuote(original, anchor({ quote: "use a queue", occurrence: 0 }))).toEqual({
      status: "found",
      index: original.indexOf("use a queue"),
    });
    expect(locateQuote(original, anchor({ quote: "use a queue", occurrence: 5 }))).toEqual({ status: "missing" });
  });

  it("reports a quote that is gone as missing", () => {
    expect(locateQuote(original, anchor({ quote: "no such text" }))).toEqual({ status: "missing" });
    expect(locateQuote(original, anchor({ quote: "" }))).toEqual({ status: "missing" });
  });

  it("keeps the highlight on the same passage when an earlier copy is added", () => {
    // Saved as the second copy ("Later, ... for jobs").
    const saved = anchor({ quote: "use a queue", occurrence: 1, prefix: "Later,", suffix: "for jobs. The end." });
    const republished = "New: you can use a queue too. " + original;
    const result = locateQuote(republished, saved);
    expect(result).toEqual({ status: "found", index: republished.indexOf("use a queue for jobs") });
  });

  it("ignores whitespace differences between saved context and the text", () => {
    const saved = anchor({ quote: "use a queue", occurrence: 1, prefix: "Later,", suffix: "for jobs." });
    expect(locateQuote("Later,   use a queue\nfor jobs.", saved)).toEqual({ status: "found", index: 9 });
  });

  it("falls back to the occurrence number when the context ties", () => {
    const text = "a x b. a x b.";
    const saved = anchor({ quote: "x", occurrence: 1, prefix: "a", suffix: "b." });
    expect(locateQuote(text, saved)).toEqual({ status: "found", index: text.lastIndexOf("x") });
  });

  it("marks the highlight as moved when no copy matches the saved context", () => {
    const saved = anchor({ quote: "use a queue", occurrence: 0, prefix: "Remember to always", suffix: "when scaling out" });
    expect(locateQuote(original, saved)).toEqual({ status: "moved" });
  });
});
