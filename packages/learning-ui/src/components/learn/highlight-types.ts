/** Shared shapes for chapter highlights and notes. The web reader and the desktop reader both use them. */

export type HighlightColor = "YELLOW" | "GREEN" | "BLUE" | "PINK";

export const HIGHLIGHT_COLORS: HighlightColor[] = ["YELLOW", "GREEN", "BLUE", "PINK"];

export const HIGHLIGHT_COLOR_LABEL: Record<HighlightColor, string> = {
  YELLOW: "Yellow",
  GREEN: "Green",
  BLUE: "Blue",
  PINK: "Pink",
};

/** Soft background used on the marked text. */
export const HIGHLIGHT_MARK_CLASS: Record<HighlightColor, string> = {
  YELLOW: "bg-yellow-200/70 dark:bg-yellow-400/30",
  GREEN: "bg-green-200/70 dark:bg-green-400/30",
  BLUE: "bg-blue-200/70 dark:bg-blue-400/30",
  PINK: "bg-pink-200/70 dark:bg-pink-400/30",
};

/** Solid colour used on small dots and bars, so the colour is easy to see. */
export const HIGHLIGHT_DOT_CLASS: Record<HighlightColor, string> = {
  YELLOW: "bg-yellow-300 dark:bg-yellow-400",
  GREEN: "bg-green-400 dark:bg-green-500",
  BLUE: "bg-blue-400 dark:bg-blue-500",
  PINK: "bg-pink-400 dark:bg-pink-500",
};

export const HIGHLIGHT_BAR_CLASS: Record<HighlightColor, string> = {
  YELLOW: "border-yellow-300 dark:border-yellow-400",
  GREEN: "border-green-400 dark:border-green-500",
  BLUE: "border-blue-400 dark:border-blue-500",
  PINK: "border-pink-400 dark:border-pink-500",
};

/** Longest note the server accepts. */
export const HIGHLIGHT_NOTE_MAX = 5000;

export type HighlightView = {
  id: string;
  color: HighlightColor;
  quote: string;
  prefix: string | null;
  suffix: string | null;
  occurrence: number;
  note: string | null;
};

export type UserHighlightView = HighlightView & {
  chapterId: string;
  chapterTitle: string;
  chapterSlug: string;
  courseSlug: string;
  courseTitle: string;
};

export type HighlightResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type NewHighlight = {
  color: HighlightColor;
  quote: string;
  prefix: string | null;
  suffix: string | null;
  occurrence: number;
  note: string | null;
};

/** What the layer needs from the app that hosts it. The web app and the desktop app each supply their own. */
export type HighlightStore = {
  create(input: NewHighlight): Promise<HighlightResult<HighlightView>>;
  update(id: string, patch: { color?: HighlightColor; note?: string | null }): Promise<HighlightResult<HighlightView>>;
  remove(id: string): Promise<HighlightResult<null>>;
};

export type HighlightNotify = (message: string, tone: "error" | "success") => void;
