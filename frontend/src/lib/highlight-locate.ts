/**
 * Pure helpers that find a saved highlight inside the chapter's plain text.
 * A highlight is stored as its quote, the text just before and after it (context),
 * and an occurrence number. After a republish an earlier copy of the same quote can
 * appear, which shifts the occurrence number, so the context decides which copy it is.
 */

export type HighlightAnchor = {
  quote: string;
  prefix: string | null;
  suffix: string | null;
  occurrence: number;
};

export type LocateResult =
  | { status: "found"; index: number }
  /** The quote exists, but no copy has surrounding text close to what was saved. */
  | { status: "moved" }
  | { status: "missing" };

/** Lowest context score (0 to 1) that still counts as the same passage. */
export const MIN_CONTEXT_SCORE = 0.5;

const squash = (text: string) => text.replace(/\s+/g, "");

function allOccurrences(full: string, quote: string): number[] {
  const found: number[] = [];
  let from = 0;
  while (true) {
    const at = full.indexOf(quote, from);
    if (at === -1) break;
    found.push(at);
    from = at + 1;
  }
  return found;
}

function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** 0 to 1 for how well the text around `index` matches the saved prefix and suffix; null when none was saved. */
export function contextScore(full: string, index: number, quoteLength: number, anchor: HighlightAnchor): number | null {
  const prefix = squash(anchor.prefix ?? "");
  const suffix = squash(anchor.suffix ?? "");
  const scores: number[] = [];
  if (prefix) {
    // Saved context keeps at most 40 characters, so a little more than that is enough on this side.
    const before = squash(full.slice(Math.max(0, index - prefix.length * 2 - 8), index));
    scores.push(commonSuffixLength(prefix, before) / prefix.length);
  }
  if (suffix) {
    const after = squash(full.slice(index + quoteLength, index + quoteLength + suffix.length * 2 + 8));
    scores.push(commonPrefixLength(suffix, after) / suffix.length);
  }
  if (scores.length === 0) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

/**
 * Picks the copy of the quote whose surroundings best match the saved context, preferring the saved
 * occurrence number on ties. With no saved context it uses the occurrence number alone.
 */
export function locateQuote(full: string, anchor: HighlightAnchor): LocateResult {
  if (!anchor.quote) return { status: "missing" };
  const candidates = allOccurrences(full, anchor.quote);
  if (candidates.length === 0) return { status: "missing" };

  const scored = candidates.map((index, position) => ({
    index,
    position,
    score: contextScore(full, index, anchor.quote.length, anchor),
  }));

  if (scored.every((c) => c.score === null)) {
    const byNumber = candidates[anchor.occurrence];
    return byNumber === undefined ? { status: "missing" } : { status: "found", index: byNumber };
  }

  const distance = (position: number) => Math.abs(position - anchor.occurrence);
  const best = scored.reduce((a, b) => {
    const as = a.score ?? 0;
    const bs = b.score ?? 0;
    if (bs !== as) return bs > as ? b : a;
    return distance(b.position) < distance(a.position) ? b : a;
  });
  if ((best.score ?? 0) < MIN_CONTEXT_SCORE) return { status: "moved" };
  return { status: "found", index: best.index };
}
