"use client";

import { useState, useMemo } from "react";
import { Download, Trash2 } from "lucide-react";
import { deleteHighlight } from "@/server/actions/highlights";
import type { UserHighlightView, HighlightColor } from "@/server/actions/highlights";
import { toast } from "@/components/ui/app-toast";
import { cn } from "@/lib/utils";

const COLOR_CLASSES: Record<HighlightColor, string> = {
  YELLOW: "bg-yellow-200/70 dark:bg-yellow-400/30",
  GREEN: "bg-green-200/70 dark:bg-green-400/30",
  BLUE: "bg-blue-200/70 dark:bg-blue-400/30",
  PINK: "bg-pink-200/70 dark:bg-pink-400/30",
};

const COLORS: HighlightColor[] = ["YELLOW", "GREEN", "BLUE", "PINK"];

export function HighlightsLibrary({ initial }: { initial: UserHighlightView[] }) {
  const [items, setItems] = useState<UserHighlightView[]>(initial);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<HighlightColor | "ALL">("ALL");
  const [pending, setPending] = useState<string | null>(null);

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
    return out;
  }, [items, selectedCourse, selectedChapter, colorFilter]);

  async function remove(id: string) {
    setPending(id);
    const res = await deleteHighlight({ highlightId: id });
    setPending(null);
    if (res.ok) setItems((prev) => prev.filter((h) => h.id !== id));
    else toast(res.error || "Could not delete the highlight.", "error");
  }

  function exportMarkdown() {
    const lines: string[] = ["# My Highlights", ""];
    const grouped = new Map<string, { title: string; chapters: Map<string, { title: string; items: UserHighlightView[] }> }>();
    for (const h of visible) {
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
          if (h.note) lines.push(`**Note:** ${h.note}`, "");
        }
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "highlights.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function selectCourse(c: string | null) {
    setSelectedCourse(c);
    setSelectedChapter(null);
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden">
      {/* Left: courses (notebooks) */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card/40 p-2 md:block">
        <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Courses</p>
        <button
          type="button"
          onClick={() => selectCourse(null)}
          className={cn(
            "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm",
            selectedCourse === null ? "bg-accent font-medium" : "hover:bg-muted"
          )}
        >
          All courses
          <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
        </button>
        {courses.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => selectCourse(c.slug)}
            className={cn(
              "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm",
              selectedCourse === c.slug ? "bg-accent font-medium" : "hover:bg-muted"
            )}
          >
            <span className="truncate">{c.title}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{c.count}</span>
          </button>
        ))}
        {courses.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No highlights yet.</p>
        )}
      </aside>

      {/* Middle: chapters (sections) */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card/20 p-2 md:block">
        <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Chapters</p>
        <button
          type="button"
          onClick={() => setSelectedChapter(null)}
          className={cn(
            "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm",
            selectedChapter === null ? "bg-accent font-medium" : "hover:bg-muted"
          )}
        >
          All chapters
          <span className="ml-auto text-xs text-muted-foreground">
            {selectedCourse ? items.filter((h) => h.courseSlug === selectedCourse).length : items.length}
          </span>
        </button>
        {chapters.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => setSelectedChapter(ch.id)}
            className={cn(
              "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm",
              selectedChapter === ch.id ? "bg-accent font-medium" : "hover:bg-muted"
            )}
          >
            <span className="truncate" title={`${ch.courseTitle}: ${ch.title}`}>{ch.title}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ch.count}</span>
          </button>
        ))}
      </aside>

      {/* Right: highlights (notes) */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">My Highlights</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setColorFilter("ALL")}
              className={cn("rounded-full px-3 py-1 text-xs", colorFilter === "ALL" ? "bg-foreground text-background" : "border border-border")}
            >
              All
            </button>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorFilter(c)}
                className={cn("rounded-full px-3 py-1 text-xs", colorFilter === c ? "bg-foreground text-background" : "border border-border")}
              >
                {c.toLowerCase()}
              </button>
            ))}
            <button
              type="button"
              onClick={exportMarkdown}
              disabled={visible.length === 0}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              <Download className="size-4" /> Export Markdown
            </button>
          </div>
        </div>

        {/* The three-pane layout hides its course and chapter panes on small screens. */}
        <div className="mb-4 grid grid-cols-2 gap-2 md:hidden">
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

        {visible.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            {items.length === 0
              ? "No highlights yet. Select text in a chapter to highlight it."
              : "No highlights match this filter."}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((h) => (
              <div key={h.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1 inline-block size-2.5 shrink-0 rounded-full", COLOR_CLASSES[h.color].split(" ")[0])} />
                  <div className="flex-1">
                    {(selectedCourse === null || selectedChapter === null) && (
                      <p className="text-xs text-muted-foreground">
                        {h.courseTitle} › {h.chapterTitle}
                      </p>
                    )}
                    <blockquote className="mt-1 text-sm italic">&ldquo;{h.quote}&rdquo;</blockquote>
                    {h.note && <p className="mt-2 text-sm text-muted-foreground">{h.note}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={pending === h.id}
                    onClick={() => remove(h.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete highlight"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <a
                  href={`/courses/${h.courseSlug}/${h.chapterSlug}`}
                  className="mt-2 inline-block text-xs text-muted-foreground hover:underline"
                >
                  Open chapter →
                </a>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
