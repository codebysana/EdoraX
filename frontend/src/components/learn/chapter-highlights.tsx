"use client";

import { useMemo } from "react";
import { HighlightsLayer } from "@buildment/learning-ui/components/learn/highlights-layer";
import type { HighlightStore } from "@buildment/learning-ui/components/learn/highlight-types";
import { saveHighlight, updateHighlight, deleteHighlight } from "@/server/actions/highlights";
import type { HighlightView } from "@/server/actions/highlights";
import { toast } from "@/components/ui/app-toast";
import { useAskChapter } from "@/components/learn/ask-chapter-context";

/**
 * Highlights and notes for the chapter in the reader. The selection toolbar, note card and chapter list live in the
 * shared learning package so the desktop app uses the same ones. This file only connects them to the web server actions
 * and keeps the floating button clear of the Ask AI button and the reader dock.
 */
export function ChapterHighlights({
  chapterId,
  initialHighlights,
  articleRef,
  focusMode = false,
  focusHighlightId = null,
}: {
  chapterId: string;
  initialHighlights: HighlightView[];
  articleRef: React.RefObject<HTMLElement | null>;
  /** Focus mode lifts the corner buttons above the reader dock. */
  focusMode?: boolean;
  /** Opened from the notebook: scroll to this highlight and show its note. */
  focusHighlightId?: string | null;
}) {
  // The Ask AI button sits in the same bottom-right corner (ask-ai-floating.tsx). When it is there,
  // this button stacks above it (3rem button + 0.75rem gap) instead of covering it.
  const { ask } = useAskChapter();
  const stacked = ask.available;
  const toggleClassName = focusMode
    ? stacked ? "bottom-[calc(5rem+3.75rem)]" : "bottom-20"
    : stacked ? "bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.75rem)] sm:bottom-[calc(1.5rem+3.75rem)]" : "bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6";
  // The list opens just above the button (about 2.25rem tall) with a small gap.
  const panelClassName = focusMode
    ? stacked ? "bottom-[calc(5rem+3.75rem+3rem)]" : "bottom-[calc(5rem+3rem)]"
    : stacked ? "bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.75rem+3rem)] sm:bottom-[calc(1.5rem+3.75rem+3rem)]" : "bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3rem)] sm:bottom-[calc(1.5rem+3rem)]";

  const store = useMemo<HighlightStore>(
    () => ({
      create: (input) => saveHighlight({ chapterId, ...input }),
      update: (id, patch) => updateHighlight({ highlightId: id, ...patch }),
      remove: async (id) => {
        const res = await deleteHighlight({ highlightId: id });
        return res.ok ? { ok: true, data: null } : res;
      },
    }),
    [chapterId],
  );

  return (
    <HighlightsLayer
      articleRef={articleRef}
      initialHighlights={initialHighlights}
      store={store}
      notify={toast}
      focusHighlightId={focusHighlightId}
      libraryHref="/highlights"
      toggleClassName={toggleClassName}
      panelClassName={panelClassName}
    />
  );
}
