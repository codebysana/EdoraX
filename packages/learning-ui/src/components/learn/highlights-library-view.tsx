"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Highlighter, NotebookPen, Search, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  HIGHLIGHT_BAR_CLASS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_LABEL,
  HIGHLIGHT_DOT_CLASS,
  HIGHLIGHT_NOTE_MAX,
  type HighlightColor,
  type HighlightNotify,
  type HighlightStore,
  type UserHighlightView,
} from "./highlight-types";

export type HighlightsLibraryViewProps = {
  initial: UserHighlightView[];
  store: Pick<HighlightStore, "update" | "remove">;
  notify: HighlightNotify;
  /** Web: a link to the chapter that jumps to the highlight. */
  chapterHref?: (h: UserHighlightView) => string;
  /** Desktop: open the chapter inside the app. */
  onOpenChapter?: (h: UserHighlightView) => void;
  /** Height of the whole view. The page that hosts it decides. */
  className?: string;
};

export function highlightsToMarkdown(items: UserHighlightView[]): string {
  const lines: string[] = ["# My highlights and notes", ""];
  const grouped = new Map<string, { title: string; chapters: Map<string, { title: string; items: UserHighlightView[] }> }>();
  for (const h of items) {
    if (!grouped.has(h.courseSlug)) grouped.set(h.courseSlug, { title: h.courseTitle, chapters: new Map() });
    const course = grouped.get(h.courseSlug)!;
    if (!course.chapters.has(h.chapterId)) course.chapters.set(h.chapterId, { title: h.chapterTitle, items: [] });
    course.chapters.get(h.chapterId)!.items.push(h);
  }
  for (const course of grouped.values()) {
    lines.push(`## ${course.title}`, "");
    for (const chapter of course.chapters.values()) {
      lines.push(`### ${chapter.title}`, "");
      for (const h of chapter.items) {
        lines.push(`> ${h.quote.split("\n").join("\n> ")}`, "");
        if (h.note) lines.push(`**Note:** ${h.note.split("\n").join("\n> ")}`, "");
      }
    }
  }
  return lines.join("\n");
}

function matches(h: UserHighlightView, query: string): boolean {
  if (!query) return true;
  const haystack = `${h.quote}\n${h.note ?? ""}\n${h.chapterTitle}\n${h.courseTitle}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function HighlightsLibraryView({
  initial,
  store,
  notify,
  chapterHref,
  onOpenChapter,
  className = "h-[calc(100dvh-4rem)]",
}: HighlightsLibraryViewProps) {
  const [items, setItems] = useState<UserHighlightView[]>(initial);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<HighlightColor | "ALL">("ALL");
  const [notesOnly, setNotesOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Group by course slug and chapter id: two courses (or chapters) can share a title.
  const courses = useMemo(() => {
    const map = new Map<string, { slug: string; title: string; count: number }>();
    for (const h of items) {
      const entry = map.get(h.courseSlug) ?? { slug: h.courseSlug, title: h.courseTitle, count: 0 };
      entry.count++;
      map.set(h.courseSlug, entry);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  const chapters = useMemo(() => {
    const filtered = selectedCourse ? items.filter((h) => h.courseSlug === selectedCourse) : items;
    const map = new Map<string, { id: string; title: string; courseTitle: string; count: number }>();
    for (const h of filtered) {
      const entry = map.get(h.chapterId) ?? { id: h.chapterId, title: h.chapterTitle, courseTitle: h.courseTitle, count: 0 };
      entry.count++;
      map.set(h.chapterId, entry);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title) || a.courseTitle.localeCompare(b.courseTitle));
  }, [items, selectedCourse]);

  const visible = useMemo(() => {
    let out = items;
    if (selectedCourse) out = out.filter((h) => h.courseSlug === selectedCourse);
    if (selectedChapter) out = out.filter((h) => h.chapterId === selectedChapter);
    if (colorFilter !== "ALL") out = out.filter((h) => h.color === colorFilter);
    if (notesOnly) out = out.filter((h) => h.note);
    return out.filter((h) => matches(h, query.trim()));
  }, [items, selectedCourse, selectedChapter, colorFilter, notesOnly, query]);

  const noteCount = items.filter((h) => h.note).length;
  const filtering = Boolean(selectedCourse || selectedChapter || colorFilter !== "ALL" || notesOnly || query.trim());

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  function selectCourse(slug: string | null) {
    setSelectedCourse(slug);
    setSelectedChapter(null);
  }

  function clearFilters() {
    setSelectedCourse(null);
    setSelectedChapter(null);
    setColorFilter("ALL");
    setNotesOnly(false);
    setQuery("");
  }

  function startEdit(h: UserHighlightView) {
    setConfirmId(null);
    setEditingId(h.id);
    setDraft(h.note ?? "");
  }

  async function saveNote(h: UserHighlightView) {
    setBusyId(h.id);
    const res = await store.update(h.id, { note: draft.trim() || null });
    setBusyId(null);
    if (!res.ok) {
      notify(res.error || "Could not save the note.", "error");
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === h.id ? { ...x, note: res.data.note, color: res.data.color } : x)));
    setEditingId(null);
  }

  async function remove(h: UserHighlightView) {
    setBusyId(h.id);
    const res = await store.remove(h.id);
    setBusyId(null);
    if (!res.ok) {
      notify(res.error || "Could not delete the highlight.", "error");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== h.id));
    setConfirmId(null);
  }

  function exportMarkdown() {
    const blob = new Blob([highlightsToMarkdown(visible)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "highlights.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const paneButton = (active: boolean) =>
    cn("flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm", active ? "bg-accent font-medium" : "hover:bg-muted");

  return (
    <div className={cn("flex overflow-hidden", className)}>
      {/* Left: courses */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card/40 p-2 md:block" aria-label="Courses">
        <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Courses</p>
        <button type="button" onClick={() => selectCourse(null)} className={paneButton(selectedCourse === null)}>
          All courses
          <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
        </button>
        {courses.map((c) => (
          <button key={c.slug} type="button" onClick={() => selectCourse(c.slug)} className={paneButton(selectedCourse === c.slug)}>
            <span className="truncate">{c.title}</span>
            <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{c.count}</span>
          </button>
        ))}
      </aside>

      {/* Middle: chapters */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card/20 p-2 md:block" aria-label="Chapters">
        <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Chapters</p>
        <button type="button" onClick={() => setSelectedChapter(null)} className={paneButton(selectedChapter === null)}>
          All chapters
          <span className="ml-auto text-xs text-muted-foreground">
            {selectedCourse ? items.filter((h) => h.courseSlug === selectedCourse).length : items.length}
          </span>
        </button>
        {chapters.map((ch) => (
          <button key={ch.id} type="button" onClick={() => setSelectedChapter(ch.id)} className={paneButton(selectedChapter === ch.id)}>
            <span className="truncate" title={`${ch.courseTitle}: ${ch.title}`}>
              {ch.title}
            </span>
            <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{ch.count}</span>
          </button>
        ))}
      </aside>

      {/* Right: highlights and notes */}
      <section aria-label="Highlights and notes" className="min-w-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">My highlights and notes</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {items.length === 0
                ? "Everything you highlight in a lesson is kept here."
                : `${items.length} highlight${items.length === 1 ? "" : "s"}, ${noteCount} with note${noteCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={exportMarkdown}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden /> Export {filtering ? "these" : "all"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">Search highlights and notes</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search highlights and notes"
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by colour">
            <button
              type="button"
              onClick={() => setColorFilter("ALL")}
              aria-pressed={colorFilter === "ALL"}
              className={cn("h-8 rounded-full px-3 text-xs", colorFilter === "ALL" ? "bg-foreground text-background" : "border border-border hover:bg-muted")}
            >
              All colours
            </button>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorFilter(colorFilter === c ? "ALL" : c)}
                aria-pressed={colorFilter === c}
                aria-label={`${HIGHLIGHT_COLOR_LABEL[c]} only`}
                title={`${HIGHLIGHT_COLOR_LABEL[c]} only`}
                className={cn(
                  "grid size-8 place-items-center rounded-full border border-border hover:bg-muted",
                  colorFilter === c && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                )}
              >
                <span className={cn("size-4 rounded-full", HIGHLIGHT_DOT_CLASS[c])} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNotesOnly((value) => !value)}
              aria-pressed={notesOnly}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs",
                notesOnly ? "bg-foreground text-background" : "border border-border hover:bg-muted",
              )}
            >
              <NotebookPen className="size-3.5" aria-hidden /> With notes
            </button>
          </div>
        </div>

        {/* The course and chapter lists are hidden on small windows, so offer them as menus. */}
        <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
          <select
            aria-label="Filter by course"
            value={selectedCourse ?? ""}
            onChange={(event) => selectCourse(event.target.value || null)}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="">All courses</option>
            {courses.map((course) => (
              <option key={course.slug} value={course.slug}>
                {course.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by chapter"
            value={selectedChapter ?? ""}
            onChange={(event) => setSelectedChapter(event.target.value || null)}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="">All chapters</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {selectedCourse ? chapter.title : `${chapter.title} (${chapter.courseTitle})`}
              </option>
            ))}
          </select>
        </div>

        {filtering && items.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            Showing {visible.length} of {items.length}.{" "}
            <button type="button" onClick={clearFilters} className="font-medium text-foreground hover:underline">
              Clear filters
            </button>
          </p>
        ) : null}

        {visible.length === 0 ? (
          <div className="mt-10 text-center">
            <Highlighter className="mx-auto size-7 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-medium">{items.length === 0 ? "No highlights yet" : "Nothing matches"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0
                ? "Select text in a lesson, pick a colour, or choose Add note to write what you want to remember."
                : "Try different words, or clear the filters."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {visible.map((h) => {
              const editing = editingId === h.id;
              return (
                <li key={h.id} className="rounded-xl border border-border p-3.5">
                  {(selectedCourse === null || selectedChapter === null) && (
                    <p className="text-xs text-muted-foreground">
                      {h.courseTitle} &rsaquo; {h.chapterTitle}
                    </p>
                  )}
                  <blockquote className={cn("mt-1.5 border-l-4 pl-3 text-sm leading-relaxed", HIGHLIGHT_BAR_CLASS[h.color])}>
                    {h.quote}
                  </blockquote>

                  {editing ? (
                    <div className="mt-3">
                      <textarea
                        ref={editRef}
                        aria-label="Note"
                        value={draft}
                        maxLength={HIGHLIGHT_NOTE_MAX}
                        rows={3}
                        placeholder="Write what you want to remember"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            setEditingId(null);
                          } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            void saveNote(h);
                          }
                        }}
                        className="block min-h-[5.5rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === h.id}
                          onClick={() => void saveNote(h)}
                          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                        >
                          {busyId === h.id ? "Saving…" : "Save note"}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                          Cancel
                        </button>
                        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Ctrl+Enter to save, Esc to cancel</span>
                      </div>
                    </div>
                  ) : h.note ? (
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm leading-relaxed">{h.note}</p>
                  ) : null}

                  {!editing ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <button type="button" onClick={() => startEdit(h)} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
                        <NotebookPen className="size-3.5" aria-hidden />
                        {h.note ? "Edit note" : "Add note"}
                      </button>
                      {chapterHref ? (
                        <a href={chapterHref(h)} className="text-muted-foreground hover:text-foreground hover:underline">
                          Open in chapter &rarr;
                        </a>
                      ) : onOpenChapter ? (
                        <button type="button" onClick={() => onOpenChapter(h)} className="text-muted-foreground hover:text-foreground hover:underline">
                          Open in chapter &rarr;
                        </button>
                      ) : null}
                      <span className="flex-1" />
                      {confirmId === h.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span>Delete{h.note ? " with its note" : ""}?</span>
                          <button type="button" disabled={busyId === h.id} onClick={() => void remove(h)} className="font-medium text-destructive hover:underline">
                            Delete
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="text-muted-foreground hover:text-foreground">
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(h.id)}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
                          aria-label="Delete highlight"
                        >
                          <Trash2 className="size-3.5" aria-hidden /> Delete
                        </button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
