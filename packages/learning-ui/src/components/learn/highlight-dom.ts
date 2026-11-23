/**
 * Browser-side helpers that turn a text selection into a highlight and draw saved highlights as <mark> elements.
 * They are shared by the web reader and the desktop reader. Nothing here depends on React.
 */

import { locateQuote } from "./highlight-locate";
import { HIGHLIGHT_MARK_CLASS, type HighlightColor, type HighlightView } from "./highlight-types";

/** Longest quote the server accepts. */
export const MAX_QUOTE_LENGTH = 500;

// Interactive chrome inside the article (the "Add a note" buttons, inputs, the
// highlight toolbar) is not lesson text. Quotes and anchors must skip it, or a
// selection that crosses a heading would store "Add a note" in the quote.
const NON_CONTENT_SELECTOR =
  "button, [role='button']:not(mark), input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-hl-toolbar]";

function isContentText(text: Text): boolean {
  const parent = text.parentElement;
  return Boolean(parent && !parent.closest(NON_CONTENT_SELECTOR));
}

export function contentTextNodes(container: HTMLElement): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    if (isContentText(text)) nodes.push(text);
  }
  return nodes;
}

type TextOffsets = { node: Text; start: number; end: number }[];

function flatten(container: HTMLElement): { full: string; offsets: TextOffsets } {
  let full = "";
  const offsets: TextOffsets = [];
  for (const node of contentTextNodes(container)) {
    const text = node.nodeValue || "";
    offsets.push({ node, start: full.length, end: full.length + text.length });
    full += text;
  }
  return { full, offsets };
}

function findTextRange(container: HTMLElement, h: HighlightView): Range | null {
  if (!h.quote) return null;
  const { full, offsets } = flatten(container);
  // Pick the copy of the quote whose surrounding text matches what was saved, so a highlight does not
  // jump to another passage when a republish adds an earlier copy of the same words.
  const located = locateQuote(full, h);
  if (located.status !== "found") return null;
  const startOffset = located.index;
  const endOffset = located.index + h.quote.length;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  for (const o of offsets) {
    if (!startNode && startOffset >= o.start && startOffset < o.end) {
      startNode = o.node;
      startNodeOffset = startOffset - o.start;
    }
    if (!endNode && endOffset > o.start && endOffset <= o.end) {
      endNode = o.node;
      endNodeOffset = endOffset - o.start;
    }
  }
  // Fallbacks for ranges that land exactly on a node boundary.
  if (!startNode && offsets.length) {
    const last = offsets[offsets.length - 1];
    startNode = last.node;
    startNodeOffset = last.node.nodeValue?.length || 0;
  }
  if (!endNode && offsets.length) {
    const last = offsets[offsets.length - 1];
    endNode = last.node;
    endNodeOffset = last.node.nodeValue?.length || 0;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

// The article's text nodes are owned by React. We never replace or normalize them: marking splits a text
// node with splitText and moves the pieces into <mark>, and unmarking moves the pieces back out and glues
// every split piece onto the node it came from, so the original Text objects React holds stay in place.
// Remaining risk: while marks are present, a React update that removes or rewrites one of these text nodes
// would act on a node whose parent is now a <mark>. The article body is static after hydration today.
const splits = new WeakMap<HTMLElement, { original: Text; extra: Text }[]>();

export function unwrapMarks(article: HTMLElement) {
  for (const mark of Array.from(article.querySelectorAll("mark.hl-mark"))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
  const records = splits.get(article) ?? [];
  // Newest first, so a piece that was split again is merged back before the piece it was split from.
  for (let i = records.length - 1; i >= 0; i--) {
    const { original, extra } = records[i];
    if (extra.parentNode && extra.parentNode === original.parentNode && original.nextSibling === extra) {
      original.nodeValue = (original.nodeValue || "") + (extra.nodeValue || "");
      extra.parentNode.removeChild(extra);
    }
  }
  splits.delete(article);
}

function splitTracked(article: HTMLElement, node: Text, offset: number): Text {
  const extra = node.splitText(offset);
  const list = splits.get(article) ?? [];
  list.push({ original: node, extra });
  splits.set(article, list);
  return extra;
}

const MARK_BASE = "hl-mark cursor-pointer rounded-[3px] text-inherit transition-[box-shadow] duration-300";
// A dotted underline tells the reader at a glance that a highlight carries a note.
const MARK_WITH_NOTE = "underline decoration-dotted decoration-2 underline-offset-4 decoration-foreground/50";

/**
 * Draws every highlight that can be found in the article and returns the ids that could not be found.
 * Overlaps are resolved per character: the later highlight wins.
 */
export function renderHighlights(article: HTMLElement, highlights: HighlightView[]): string[] {
  unwrapMarks(article);
  const nodeColors = new Map<Text, (HighlightColor | null)[]>();
  const nodeIds = new Map<Text, (string | null)[]>();

  const resolved: { h: HighlightView; range: Range }[] = [];
  const unanchored: string[] = [];
  for (const h of highlights) {
    const range = findTextRange(article, h);
    if (range) resolved.push({ h, range });
    else unanchored.push(h.id);
  }

  const allNodes = contentTextNodes(article);
  for (const { h, range } of resolved) {
    for (const tn of allNodes.filter((node) => range.intersectsNode(node))) {
      const len = tn.nodeValue?.length || 0;
      if (!nodeColors.has(tn)) {
        nodeColors.set(tn, new Array(len).fill(null));
        nodeIds.set(tn, new Array(len).fill(null));
      }
      const colors = nodeColors.get(tn)!;
      const ids = nodeIds.get(tn)!;
      let start = 0;
      let end = len;
      if (tn === range.startContainer) start = range.startOffset;
      if (tn === range.endContainer) end = range.endOffset;
      for (let i = start; i < end && i < len; i++) {
        colors[i] = h.color;
        ids[i] = h.id;
      }
    }
  }

  const byId = new Map(highlights.map((h) => [h.id, h]));
  for (const [tn, colors] of nodeColors) {
    const ids = nodeIds.get(tn)!;
    const len = tn.nodeValue?.length || 0;
    const runs: { start: number; end: number; color: HighlightColor; id: string }[] = [];
    let i = 0;
    while (i < len) {
      const color = colors[i];
      const id = ids[i];
      let j = i;
      while (j < len && colors[j] === color && ids[j] === id) j++;
      if (color && id) runs.push({ start: i, end: j, color, id });
      i = j;
    }
    // Last run first: `tn` keeps shrinking from the right, so earlier offsets stay valid.
    for (let r = runs.length - 1; r >= 0; r--) {
      const run = runs[r];
      if (run.end < (tn.nodeValue?.length || 0)) splitTracked(article, tn, run.end);
      const target = run.start > 0 ? splitTracked(article, tn, run.start) : tn;
      const parent = target.parentNode;
      if (!parent) continue;
      const h = byId.get(run.id);
      const mark = document.createElement("mark");
      mark.className = [MARK_BASE, HIGHLIGHT_MARK_CLASS[run.color], h?.note ? MARK_WITH_NOTE : ""].filter(Boolean).join(" ");
      mark.dataset.highlightId = run.id;
      if (h?.note) mark.title = h.note.length > 300 ? `${h.note.slice(0, 300)}…` : h.note;
      parent.insertBefore(mark, target);
      mark.appendChild(target);
    }
  }

  // Keyboard users reach a highlight through its first mark only, so a highlight that crosses several
  // elements is one Tab stop. The mark keeps its text as its name, so screen readers still read the lesson.
  const seen = new Set<string>();
  for (const mark of Array.from(article.querySelectorAll<HTMLElement>("mark.hl-mark"))) {
    const id = mark.dataset.highlightId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    mark.tabIndex = 0;
    mark.setAttribute("role", "button");
    mark.setAttribute("aria-haspopup", "dialog");
    mark.dataset.hlFirst = "true";
  }
  return unanchored;
}

function offsetForBoundary(offsets: TextOffsets, container: Node, offset: number, side: "start" | "end"): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container as Text;
    const entry = offsets.find((item) => item.node === text);
    if (entry) return entry.start + offset;
  }
  // Element boundary: use the first or last content text node inside it.
  if (container.nodeType === Node.ELEMENT_NODE) {
    const inside = contentTextNodes(container as HTMLElement);
    const target = side === "start" ? inside[0] : inside[inside.length - 1];
    if (target) {
      const entry = offsets.find((item) => item.node === target);
      if (entry) return entry.start + (side === "start" ? 0 : target.nodeValue?.length || 0);
    }
  }
  return null;
}

export type SelectionAnchor = {
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
};

export type SelectionResult = { ok: true; anchor: SelectionAnchor } | { ok: false; reason: "too-long" };

/** Reads the current selection as a highlight anchor, or null when there is nothing to highlight. */
export function selectionToHighlight(article: HTMLElement, sel: Selection): SelectionResult | null {
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return null;
  if (!article.contains(range.commonAncestorContainer)) return null;

  const { full, offsets } = flatten(article);
  const startOffset = offsetForBoundary(offsets, range.startContainer, range.startOffset, "start");
  const endOffset = offsetForBoundary(offsets, range.endContainer, range.endOffset, "end");
  if (startOffset == null || endOffset == null || endOffset <= startOffset) return null;

  const raw = full.slice(startOffset, endOffset);
  const leading = raw.length - raw.trimStart().length;
  const quote = raw.trim();
  if (!quote) return null;
  if (quote.length > MAX_QUOTE_LENGTH) return { ok: false, reason: "too-long" };
  const quoteStart = startOffset + leading;
  const quoteEnd = quoteStart + quote.length;

  let occurrence = 0;
  let searchFrom = 0;
  while (true) {
    const found = full.indexOf(quote, searchFrom);
    if (found === -1 || found > quoteStart) break;
    occurrence++;
    searchFrom = found + 1;
    if (found === quoteStart) break;
  }
  occurrence = Math.max(0, occurrence - 1);

  const prefix = full.slice(Math.max(0, quoteStart - 40), quoteStart);
  const suffix = full.slice(quoteEnd, quoteEnd + 40);
  return { ok: true, anchor: { quote, prefix, suffix, occurrence } };
}

export function highlightMarks(article: HTMLElement, id: string): HTMLElement[] {
  return Array.from(article.querySelectorAll<HTMLElement>("mark.hl-mark")).filter((mark) => mark.dataset.highlightId === id);
}

/** The box around a highlight, or null when it is not drawn in the text. */
export function highlightRect(article: HTMLElement, id: string): DOMRect | null {
  const marks = highlightMarks(article, id);
  if (marks.length === 0) return null;
  // A highlight can wrap onto several lines; anchor to its first line so a card never covers the text.
  const rects = marks.flatMap((mark) => Array.from(mark.getClientRects()));
  return rects[0] ?? marks[0].getBoundingClientRect();
}

/** Document order of the highlights that are drawn in the text. */
export function highlightOrder(article: HTMLElement): string[] {
  const ids: string[] = [];
  for (const mark of Array.from(article.querySelectorAll<HTMLElement>("mark.hl-mark"))) {
    const id = mark.dataset.highlightId;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const FLASH_CLASSES = ["ring-2", "ring-foreground/50"];
const flashTimers = new WeakMap<HTMLElement, number>();

/** Scrolls a highlight to the middle of the screen and rings it for a moment. Returns false when it is not in the text. */
export function revealHighlight(article: HTMLElement, id: string): boolean {
  const marks = highlightMarks(article, id);
  if (marks.length === 0) return false;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  marks[0].scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  for (const mark of marks) {
    mark.classList.add(...FLASH_CLASSES);
    window.clearTimeout(flashTimers.get(mark));
    flashTimers.set(
      mark,
      window.setTimeout(() => mark.classList.remove(...FLASH_CLASSES), 1800),
    );
  }
  return true;
}
