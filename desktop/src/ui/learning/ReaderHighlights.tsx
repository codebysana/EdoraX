import { useEffect, useMemo, useState, type RefObject } from 'react';
import { HighlightsLayer } from '@buildment/learning-ui/components/learn/highlights-layer';
import type {
  HighlightResult,
  HighlightStore,
  HighlightView,
} from '@buildment/learning-ui/components/learn/highlight-types';
import { useToast } from '../toast/Toast';

type Reply<T> = { ok: true; data: T } | { ok: false; message: string };

/** The server answers with `message`; the shared highlight UI reads `error`. */
export function toHighlightResult<T>(reply: Reply<T>): HighlightResult<T> {
  return reply.ok ? { ok: true, data: reply.data } : { ok: false, error: reply.message };
}

/** Highlights and notes for the open lesson. The selection toolbar, note card and list are shared with the web reader. */
export function ReaderHighlights({
  chapterId,
  articleRef,
  renderKey,
  focusHighlightId,
  onOpenLibrary,
}: {
  chapterId: string;
  articleRef: RefObject<HTMLElement | null>;
  renderKey: unknown;
  focusHighlightId?: string;
  onOpenLibrary: () => void;
}) {
  const toast = useToast();
  const [initial, setInitial] = useState<HighlightView[] | null>(null);

  useEffect(() => {
    let alive = true;
    setInitial(null);
    window.buildment.learning.highlights
      .chapter(chapterId)
      .then((result) => {
        // When the list cannot be loaded (for example offline) the reader stays free of highlight tools instead of showing an empty list that is wrong.
        if (alive && result.ok) setInitial(result.data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [chapterId]);

  const store = useMemo<HighlightStore>(
    () => ({
      create: async (input) =>
        toHighlightResult(await window.buildment.learning.highlights.create(chapterId, input)),
      update: async (id, patch) =>
        toHighlightResult(await window.buildment.learning.highlights.update(id, patch)),
      remove: async (id) =>
        toHighlightResult(await window.buildment.learning.highlights.remove(id)),
    }),
    [chapterId],
  );
  const notify = useMemo(
    () => (message: string, tone: 'error' | 'success') =>
      tone === 'error' ? toast.error(message) : toast.success(message),
    [toast],
  );

  if (!initial) return null;
  return (
    <HighlightsLayer
      articleRef={articleRef}
      initialHighlights={initial}
      store={store}
      notify={notify}
      renderKey={renderKey}
      focusHighlightId={focusHighlightId}
      onOpenLibrary={onOpenLibrary}
    />
  );
}
