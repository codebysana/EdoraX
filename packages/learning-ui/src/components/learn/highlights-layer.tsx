"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Highlighter, NotebookPen, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  highlightOrder,
  highlightRect,
  MAX_QUOTE_LENGTH,
  renderHighlights,
  revealHighlight,
  selectionToHighlight,
  type SelectionAnchor,
} from "./highlight-dom";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_LABEL,
  HIGHLIGHT_BAR_CLASS,
  HIGHLIGHT_DOT_CLASS,
  HIGHLIGHT_NOTE_MAX,
  type HighlightColor,
  type HighlightNotify,
  type HighlightStore,
  type HighlightView,
} from "./highlight-types";

type SelectionState = { anchor: SelectionAnchor | null; tooLong: boolean; range: Range };
type SaveStatus = "idle" | "saving" | "saved" | "error";

const TOOLBAR_HALF_WIDTH = 150;
const CARD_WIDTH = 340;
const CARD_HEIGHT_GUESS = 300;
const NARROW = 640;

const isCoarsePointer = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Re-measures an element's box when the page scrolls or resizes, so floating cards follow the text. */
function useAnchorRect(measure: () => DOMRect | null, active: boolean, key: unknown) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  useLayoutEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(measureRef.current()));
    };
    setRect(measureRef.current());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active, key]);
  return rect;
}

export type HighlightsLayerProps = {
  /** The element that holds the lesson text. */
  articleRef: React.RefObject<HTMLElement | null>;
  initialHighlights: HighlightView[];
  store: HighlightStore;
  notify: HighlightNotify;
  /** Scroll to this highlight when the chapter opens, and show its note. Used by links from the notebook. */
  focusHighlightId?: string | null;
  /** Change this when the lesson text is replaced, so the marks are drawn again. */
  renderKey?: unknown;
  /** Link to the page with every highlight. Give this or `onOpenLibrary`. */
  libraryHref?: string;
  onOpenLibrary?: () => void;
  /** Vertical position of the floating button and the list above it, for example "bottom-4". */
  toggleClassName?: string;
  panelClassName?: string;
};

export function HighlightsLayer({
  articleRef,
  initialHighlights,
  store,
  notify,
  focusHighlightId = null,
  renderKey,
  libraryHref,
  onOpenLibrary,
  toggleClassName = "bottom-4 sm:bottom-6",
  panelClassName = "bottom-[4.5rem] sm:bottom-[5.5rem]",
}: HighlightsLayerProps) {
  const [highlights, setHighlights] = useState<HighlightView[]>(initialHighlights);
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  // Ids whose passage moved or could not be found in this version of the chapter, and the reading order of the rest.
  const [unanchored, setUnanchored] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const selectionRef = useRef<SelectionState | null>(null);
  selectionRef.current = selection;
  const [pending, setPending] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmPanelDelete, setConfirmPanelDelete] = useState<string | null>(null);

  // The note card.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const draftRef = useRef("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [cardError, setCardError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const returnFocusId = useRef<string | null>(null);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const pointerDown = useRef(false);
  const deepLinkDone = useRef(false);

  const draw = useCallback(() => {
    const article = articleRef.current;
    if (!article) return;
    setUnanchored(renderHighlights(article, highlightsRef.current));
    setOrder(highlightOrder(article));
  }, [articleRef]);

  // Draw the marks whenever the highlights change.
  useEffect(() => {
    draw();
  }, [highlights, renderKey, draw]);

  // The article can finish rendering after the first paint (code blocks, diagrams), so draw again shortly after mount.
  useEffect(() => {
    const timers = [window.setTimeout(draw, 60), window.setTimeout(draw, 800)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [draw, renderKey]);

  // ---- Selection toolbar -------------------------------------------------------------------------------------

  useEffect(() => {
    let timer = 0;
    const evaluate = () => {
      const article = articleRef.current;
      const sel = window.getSelection();
      if (!article || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const parsed = selectionToHighlight(article, sel);
      if (!parsed) {
        setSelection(null);
        return;
      }
      setSelection({ anchor: parsed.ok ? parsed.anchor : null, tooLong: !parsed.ok, range: sel.getRangeAt(0).cloneRange() });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      // While the mouse button is down the selection is still being dragged, so wait for it to settle.
      if (pointerDown.current) return;
      timer = window.setTimeout(evaluate, 160);
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-hl-toolbar]")) return;
      pointerDown.current = event.pointerType === "mouse";
    };
    const onUp = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      schedule();
    };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, [articleRef]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      window.getSelection()?.removeAllRanges();
      setSelection(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selection]);

  const selectionRect = useAnchorRect(() => selection?.range.getBoundingClientRect() ?? null, Boolean(selection), selection);

  // ---- Creating, changing and deleting -----------------------------------------------------------------------

  const findExisting = (anchor: SelectionAnchor) =>
    highlightsRef.current.find((h) => h.quote === anchor.quote && h.occurrence === anchor.occurrence) ?? null;

  async function createHighlight(color: HighlightColor, thenNote: boolean) {
    const current = selectionRef.current;
    if (!current?.anchor || pending) return;
    const anchor = current.anchor;
    const existing = findExisting(anchor);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    if (existing) {
      // Same text again: change the colour or open the note instead of failing with "already highlighted".
      if (existing.color !== color) await changeColor(existing, color);
      if (thenNote) openCard(existing);
      return;
    }
    setPending(true);
    const res = await store.create({
      color,
      quote: anchor.quote,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      occurrence: anchor.occurrence,
      note: null,
    });
    setPending(false);
    if (!res.ok) {
      notify(res.error || "Could not save the highlight.", "error");
      return;
    }
    setHighlights((prev) => [...prev, res.data]);
    if (thenNote) setOpenNoteFor(res.data.id);
  }

  async function changeColor(h: HighlightView, color: HighlightColor) {
    if (h.color === color) return;
    const res = await store.update(h.id, { color });
    if (res.ok) setHighlights((prev) => prev.map((x) => (x.id === h.id ? res.data : x)));
    else notify(res.error || "Could not change the colour.", "error");
  }

  async function removeHighlight(h: HighlightView) {
    setPending(true);
    const res = await store.remove(h.id);
    setPending(false);
    if (!res.ok) {
      notify(res.error || "Could not delete the highlight.", "error");
      return false;
    }
    setHighlights((prev) => prev.filter((x) => x.id !== h.id));
    if (activeIdRef.current === h.id) closeNow(false);
    setConfirmPanelDelete(null);
    return true;
  }

  // ---- The note card -----------------------------------------------------------------------------------------

  /** Saves a note. Saves run one after another so a slow answer never overwrites a newer one. */
  const persistNote = useCallback(
    (id: string, note: string): Promise<boolean> => {
      const run = async () => {
        const known = highlightsRef.current.find((h) => h.id === id);
        if (!known) return true;
        const clean = note.trim();
        if ((known.note ?? "") === clean) return true;
        if (activeIdRef.current === id) {
          setStatus("saving");
          setCardError(null);
        }
        const res = await store.update(id, { note: clean || null });
        if (res.ok) {
          setHighlights((prev) => prev.map((h) => (h.id === id ? res.data : h)));
          if (activeIdRef.current === id) setStatus("saved");
          return true;
        }
        if (activeIdRef.current === id) {
          setStatus("error");
          setCardError(res.error || "Could not save the note.");
        } else {
          notify(res.error || "Could not save the note.", "error");
        }
        return false;
      };
      const next = saveChain.current.then(run, run);
      saveChain.current = next;
      return next as Promise<boolean>;
    },
    [store, notify],
  );

  const activeHighlight = highlights.find((h) => h.id === activeId) ?? null;
  const dirty = activeHighlight ? draft.trim() !== (activeHighlight.note ?? "") : false;

  function openCard(h: HighlightView, options: { focus?: boolean } = {}) {
    const previous = activeIdRef.current;
    if (previous && previous !== h.id) void persistNote(previous, draftRef.current);
    if (previous !== h.id) {
      // Closing the card puts focus back on the highlight, so a keyboard reader keeps their place.
      returnFocusId.current = h.id;
      draftRef.current = h.note ?? "";
      setDraft(h.note ?? "");
    }
    setStatus("idle");
    setCardError(null);
    setConfirmDelete(false);
    setPanelOpen(false);
    setActiveId(h.id);
    // Reading a note on a touch screen should not pop up the keyboard.
    const focus = options.focus ?? !(isCoarsePointer() && h.note);
    window.setTimeout(() => {
      if (focus) {
        const field = noteRef.current;
        field?.focus();
        field?.setSelectionRange(field.value.length, field.value.length);
      }
    }, 0);
  }

  function closeNow(restoreFocus: boolean) {
    const id = returnFocusId.current;
    returnFocusId.current = null;
    setActiveId(null);
    setStatus("idle");
    setCardError(null);
    setConfirmDelete(false);
    if (restoreFocus && id) {
      window.setTimeout(() => {
        articleRef.current?.querySelector<HTMLElement>(`mark.hl-mark[data-hl-first][data-highlight-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      }, 0);
    }
  }

  /** Closing keeps a changed note. When the last save failed, closing drops it so the reader is never stuck. */
  async function closeCard(restoreFocus = true) {
    const id = activeIdRef.current;
    if (!id) return;
    if (status !== "error" && draftRef.current.trim() !== (highlightsRef.current.find((h) => h.id === id)?.note ?? "")) {
      const saved = await persistNote(id, draftRef.current);
      if (!saved) return;
    }
    if (activeIdRef.current === id) closeNow(restoreFocus);
  }

  // Save a pause after the reader stops typing.
  useEffect(() => {
    if (!activeId || !dirty || status === "error") return;
    const id = activeId;
    const timer = window.setTimeout(() => void persistNote(id, draftRef.current), 1200);
    return () => window.clearTimeout(timer);
  }, [activeId, dirty, draft, status, persistNote]);

  // A note typed just before leaving the page is still saved.
  useEffect(
    () => () => {
      const id = activeIdRef.current;
      if (id) void persistNote(id, draftRef.current);
    },
    [persistNote],
  );

  // Open the note right after a highlight was made from the toolbar, once its mark is drawn.
  useEffect(() => {
    if (!openNoteFor) return;
    const created = highlights.find((h) => h.id === openNoteFor);
    if (!created) return;
    setOpenNoteFor(null);
    openCard(created);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, openNoteFor]);

  // Clicking or pressing Enter on a highlight opens its note.
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const markFrom = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a[href]")) return null;
      const mark = target?.closest<HTMLElement>("mark.hl-mark");
      const id = mark?.dataset.highlightId;
      return id ? highlightsRef.current.find((h) => h.id === id) ?? null : null;
    };
    const onClick = (event: MouseEvent) => {
      // Finishing a drag-select that ends inside a highlight is not a click on it.
      if (!window.getSelection()?.isCollapsed) return;
      const h = markFrom(event);
      if (h) openCard(h);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const h = markFrom(event);
      if (!h) return;
      event.preventDefault();
      openCard(h);
    };
    article.addEventListener("click", onClick);
    article.addEventListener("keydown", onKey);
    return () => {
      article.removeEventListener("click", onClick);
      article.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleRef]);

  // Close the card when the reader presses somewhere else, unless it is another highlight.
  useEffect(() => {
    if (!activeId) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("[data-hl-card]") || target.closest("mark.hl-mark") || target.closest("[data-hl-keep]")) return;
      void closeCard(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, status]);

  // Open a highlight from a link: scroll to it and show its note.
  useEffect(() => {
    if (!focusHighlightId || deepLinkDone.current) return;
    const timer = window.setTimeout(() => {
      const article = articleRef.current;
      const h = highlightsRef.current.find((x) => x.id === focusHighlightId);
      if (!article || !h) return;
      deepLinkDone.current = true;
      if (!revealHighlight(article, h.id)) {
        notify("That highlight is no longer in the text. It is still listed under Highlights.", "error");
        return;
      }
      if (h.note) openCard(h, { focus: false });
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusHighlightId, articleRef]);

  // Fit the note field to what was typed.
  useLayoutEffect(() => {
    const field = noteRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 220)}px`;
  }, [draft, activeId]);

  const cardKey = `${activeId}:${highlights.length}:${activeHighlight?.note ?? ""}:${activeHighlight?.color ?? ""}`;
  const cardAnchor = useAnchorRect(
    () => (activeId && articleRef.current ? highlightRect(articleRef.current, activeId) : null),
    Boolean(activeId),
    cardKey,
  );

  function onCardKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      void closeCard();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void closeCard();
    }
  }

  // ---- Chapter list ------------------------------------------------------------------------------------------

  const listed = useMemo(() => {
    const byId = new Map(highlights.map((h) => [h.id, h]));
    const inText = order.map((id) => byId.get(id)).filter((h): h is HighlightView => Boolean(h));
    const rest = highlights.filter((h) => !order.includes(h.id));
    return [...inText, ...rest];
  }, [highlights, order]);
  const noteCount = highlights.filter((h) => h.note).length;

  function showInText(h: HighlightView) {
    const article = articleRef.current;
    if (!article) return;
    if (typeof window !== "undefined" && window.innerWidth < NARROW) setPanelOpen(false);
    if (!revealHighlight(article, h.id)) notify("That highlight is not in the text of this version of the chapter.", "error");
  }

  function editFromPanel(h: HighlightView) {
    const article = articleRef.current;
    if (article) revealHighlight(article, h.id);
    openCard(h);
  }

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || activeIdRef.current) return;
      setPanelOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  // ---- Render ------------------------------------------------------------------------------------------------

  const viewport = typeof window === "undefined" ? { w: 1024, h: 768 } : { w: window.innerWidth, h: window.innerHeight };
  const narrow = viewport.w < NARROW;

  let toolbar: React.ReactNode = null;
  if (selection && selectionRect && selectionRect.bottom > 0 && selectionRect.top < viewport.h) {
    const below = isCoarsePointer() || selectionRect.top < 76;
    const left = clamp(selectionRect.left + selectionRect.width / 2, TOOLBAR_HALF_WIDTH + 8, viewport.w - TOOLBAR_HALF_WIDTH - 8);
    toolbar = (
      <div
        data-hl-toolbar
        role="toolbar"
        aria-label="Highlight the selected text"
        onMouseDown={(event) => event.preventDefault()}
        className="fixed z-[70] flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg"
        style={{
          left,
          top: below ? Math.min(selectionRect.bottom + 12, viewport.h - 56) : selectionRect.top - 10,
          transform: below ? "translateX(-50%)" : "translate(-50%, -100%)",
        }}
      >
        {selection.tooLong ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Select {MAX_QUOTE_LENGTH} characters or fewer.</p>
        ) : (
          <>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                disabled={pending}
                onClick={() => void createHighlight(color, false)}
                title={`Highlight ${HIGHLIGHT_COLOR_LABEL[color].toLowerCase()}`}
                aria-label={`Highlight ${HIGHLIGHT_COLOR_LABEL[color].toLowerCase()}`}
                className={cn(
                  "size-8 rounded-full border border-black/10 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 sm:size-7",
                  HIGHLIGHT_DOT_CLASS[color],
                )}
              />
            ))}
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <button
              type="button"
              disabled={pending}
              onClick={() => void createHighlight("YELLOW", true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 sm:h-7"
            >
              <NotebookPen className="size-3.5" aria-hidden />
              Add note
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  let card: React.ReactNode = null;
  if (activeHighlight) {
    const place: React.CSSProperties = narrow
      ? { left: 8, right: 8, bottom: "max(0.5rem, env(safe-area-inset-bottom))" }
      : cardAnchor
        ? (() => {
            const left = clamp(cardAnchor.left, 8, viewport.w - CARD_WIDTH - 8);
            const fitsBelow = cardAnchor.bottom + 8 + CARD_HEIGHT_GUESS < viewport.h;
            return fitsBelow
              ? { left, top: Math.max(8, cardAnchor.bottom + 8), width: CARD_WIDTH }
              : { left, top: clamp(cardAnchor.top - 8, 8, viewport.h - 8), width: CARD_WIDTH, transform: "translateY(-100%)" };
          })()
        : { left: "50%", top: "50%", width: CARD_WIDTH, transform: "translate(-50%, -50%)" };
    const statusText =
      status === "saving"
        ? "Saving…"
        : status === "error"
          ? null
          : dirty
            ? "Saves when you stop typing"
            : status === "saved" || activeHighlight.note
              ? "Saved"
              : "Private to you";
    card = (
      <div
        ref={cardRef}
        data-hl-card
        data-hl-toolbar
        role="dialog"
        aria-label="Highlight note"
        onKeyDown={onCardKeyDown}
        className="fixed z-[70] max-h-[min(80vh,420px)] overflow-y-auto rounded-xl border border-border bg-card p-3 text-card-foreground shadow-xl"
        style={place}
      >
        <div className="flex items-center gap-1.5">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => void changeColor(activeHighlight, color)}
              aria-label={`${HIGHLIGHT_COLOR_LABEL[color]} highlight`}
              aria-pressed={activeHighlight.color === color}
              title={HIGHLIGHT_COLOR_LABEL[color]}
              className={cn(
                "size-6 rounded-full border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                HIGHLIGHT_DOT_CLASS[color],
                activeHighlight.color === color && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            />
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => (draft.trim() || activeHighlight.note ? setConfirmDelete(true) : void removeHighlight(activeHighlight))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
            aria-label="Delete highlight"
            title="Delete highlight"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => (status === "error" ? closeNow(true) : void closeCard())}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <blockquote className={cn("mt-2.5 line-clamp-2 border-l-4 pl-2.5 text-xs italic text-muted-foreground", HIGHLIGHT_BAR_CLASS[activeHighlight.color])}>
          {activeHighlight.quote}
        </blockquote>

        <textarea
          ref={noteRef}
          aria-label="Your note"
          value={draft}
          onChange={(event) => {
            draftRef.current = event.target.value;
            setDraft(event.target.value);
            if (status === "saved" || status === "error") setStatus("idle");
          }}
          maxLength={HIGHLIGHT_NOTE_MAX}
          rows={3}
          placeholder="Write what you want to remember"
          className="mt-2.5 block max-h-[220px] min-h-[5.5rem] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />

        {cardError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {cardError} Your note is still here. Try Done again, or close to drop it.
          </p>
        ) : null}

        {confirmDelete ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2">
            <p className="text-xs text-foreground">Delete this highlight and its note?</p>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => void removeHighlight(activeHighlight)}
                className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-2.5 py-1 text-xs">
                Keep
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {statusText}
            </p>
            <button
              type="button"
              onClick={() => void closeCard()}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Done
              <span className="ml-1.5 hidden font-normal opacity-60 sm:inline">Ctrl+Enter</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {toolbar}
      {card}

      <button
        ref={toggleRef}
        type="button"
        data-hl-keep
        onClick={() => setPanelOpen((open) => !open)}
        className={cn(
          "fixed right-4 z-50 mb-[var(--audiobook-bar-space,0px)] inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg hover:bg-muted sm:right-6",
          toggleClassName,
        )}
        aria-label={`Highlights, ${highlights.length} saved${noteCount ? `, ${noteCount} with notes` : ""}`}
        aria-expanded={panelOpen}
      >
        <Highlighter className="size-4" aria-hidden />
        Highlights{highlights.length ? ` (${highlights.length})` : ""}
      </button>

      {panelOpen && (
        <div
          data-hl-keep
          role="region"
          aria-label="Highlights in this chapter"
          className={cn(
            "fixed right-4 z-50 mb-[var(--audiobook-bar-space,0px)] flex max-h-[min(70vh,34rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-card shadow-2xl sm:right-6",
            panelClassName,
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">This chapter</p>
              {highlights.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {highlights.length} highlight{highlights.length === 1 ? "" : "s"}
                  {noteCount ? `, ${noteCount} with note${noteCount === 1 ? "" : "s"}` : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setPanelOpen(false);
                toggleRef.current?.focus();
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {unanchored.length > 0 ? (
              <p className="mb-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                {unanchored.length} highlight{unanchored.length === 1 ? "" : "s"} moved or could not be found in this version of the chapter.{" "}
                {unanchored.length === 1 ? "It is" : "They are"} kept here but not marked in the text.
              </p>
            ) : null}
            {highlights.length === 0 ? (
              <div className="py-4 text-center">
                <Highlighter className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-medium">No highlights yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Select any text in the lesson, then pick a colour or choose Add note.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {listed.map((h) => (
                  <li key={h.id} className="rounded-lg border border-border p-2.5">
                    <button type="button" onClick={() => showInText(h)} className="flex w-full items-start gap-2 text-left" title="Show in the lesson">
                      <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", HIGHLIGHT_DOT_CLASS[h.color])} />
                      <span className="line-clamp-3 text-sm">&ldquo;{h.quote}&rdquo;</span>
                    </button>
                    {unanchored.includes(h.id) ? <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">Moved or not found</p> : null}
                    {h.note ? <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap border-l-2 border-border pl-2 text-xs text-muted-foreground">{h.note}</p> : null}
                    {confirmPanelDelete === h.id ? (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span>Delete{h.note ? " with its note" : ""}?</span>
                        <button type="button" disabled={pending} onClick={() => void removeHighlight(h)} className="font-medium text-destructive hover:underline">
                          Delete
                        </button>
                        <button type="button" onClick={() => setConfirmPanelDelete(null)} className="text-muted-foreground hover:text-foreground">
                          Keep
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <button type="button" onClick={() => editFromPanel(h)} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                          <NotebookPen className="size-3.5" aria-hidden />
                          {h.note ? "Edit note" : "Add note"}
                        </button>
                        <button type="button" onClick={() => setConfirmPanelDelete(h.id)} className="text-muted-foreground hover:text-destructive hover:underline">
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {libraryHref || onOpenLibrary ? (
            <div className="border-t border-border px-3 py-2">
              {libraryHref ? (
                <a href={libraryHref} className="text-xs font-medium text-foreground hover:underline">
                  Open all my highlights and notes &rarr;
                </a>
              ) : (
                <button type="button" onClick={onOpenLibrary} className="text-xs font-medium text-foreground hover:underline">
                  Open all my highlights and notes &rarr;
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
