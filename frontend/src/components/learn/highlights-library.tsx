"use client";

import { useMemo } from "react";
import { HighlightsLibraryView } from "@buildment/learning-ui/components/learn/highlights-library-view";
import type { HighlightStore } from "@buildment/learning-ui/components/learn/highlight-types";
import { updateHighlight, deleteHighlight } from "@/server/actions/highlights";
import type { UserHighlightView } from "@/server/actions/highlights";
import { toast } from "@/components/ui/app-toast";

/** The notebook page: every highlight and note, with search, filters and inline editing (shared with the desktop app). */
export function HighlightsLibrary({ initial }: { initial: UserHighlightView[] }) {
  const store = useMemo<Pick<HighlightStore, "update" | "remove">>(
    () => ({
      update: (id, patch) => updateHighlight({ highlightId: id, ...patch }),
      remove: async (id) => {
        const res = await deleteHighlight({ highlightId: id });
        return res.ok ? { ok: true, data: null } : res;
      },
    }),
    [],
  );
  return (
    <HighlightsLibraryView
      initial={initial}
      store={store}
      notify={toast}
      chapterHref={(h) => `/courses/${encodeURIComponent(h.courseSlug)}/${encodeURIComponent(h.chapterSlug)}?highlight=${encodeURIComponent(h.id)}`}
    />
  );
}
