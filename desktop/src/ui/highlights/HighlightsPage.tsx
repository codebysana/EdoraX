import { useCallback, useEffect, useMemo, useState } from 'react';
import { HighlightsLibraryView } from '@buildment/learning-ui/components/learn/highlights-library-view';
import type {
  HighlightStore,
  UserHighlightView,
} from '@buildment/learning-ui/components/learn/highlight-types';
import { useToast } from '../toast/Toast';
import { toHighlightResult } from '../learning/ReaderHighlights';

/** Every highlight and note the learner made, across courses. */
export function HighlightsPage({
  onOpenChapter,
}: {
  /** Returns false when the course cannot be opened. */
  onOpenChapter: (highlight: UserHighlightView) => boolean;
}) {
  const toast = useToast();
  const [items, setItems] = useState<UserHighlightView[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setError('');
    setItems(null);
    window.buildment.learning.highlights
      .all()
      .then((result) => {
        if (result.ok) setItems(result.data);
        else setError(result.message);
      })
      .catch(() => setError('The desktop connection is unavailable. Restart the app and try again.'));
  }, []);
  useEffect(load, [load]);

  const store = useMemo<Pick<HighlightStore, 'update' | 'remove'>>(
    () => ({
      update: async (id, patch) =>
        toHighlightResult(await window.buildment.learning.highlights.update(id, patch)),
      remove: async (id) =>
        toHighlightResult(await window.buildment.learning.highlights.remove(id)),
    }),
    [],
  );

  if (error)
    return (
      <div role="alert" className="m-auto mt-16 max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-semibold">Your highlights did not load</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  if (!items)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading your highlights…
      </p>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      {notice && (
        <p role="status" className="border-b border-border bg-muted/40 px-4 py-2 text-sm">
          {notice}
        </p>
      )}
      <HighlightsLibraryView
        initial={items}
        store={store}
        notify={(message, tone) => (tone === 'error' ? toast.error(message) : toast.success(message))}
        onOpenChapter={(h) => {
          setNotice(onOpenChapter(h) ? '' : 'That course is not in your course list right now.');
        }}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
