"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { COBALT, INK, LINE, MUTED, TINT, YELLOW } from "./brand";
import { StepHeading, type StepProps } from "./step-frame";
import s from "./try-it.module.css";

const RIGHT_ORDER = ["dns", "connect", "request", "reply"] as const;
type BlockId = (typeof RIGHT_ORDER)[number];

const LABELS: Record<BlockId, string> = {
  dns: "Ask DNS for the address",
  connect: "Connect to the server",
  request: "Send the request",
  reply: "Get the page back",
};

const START: BlockId[] = ["request", "dns", "reply", "connect"];

function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Step 2: put the four steps of loading a page in order. Drag a block with a mouse or
 * finger, or with the keyboard: Space picks a block up, the arrow keys move it, Space
 * or Escape puts it down.
 */
type Drag = { id: BlockId; from: number; startY: number; dy: number; slot: number; pointerId: number };

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function OrderStep({ onSolved, headingRef }: StepProps) {
  const [order, setOrder] = useState<BlockId[]>(START);
  const [lifted, setLifted] = useState<BlockId | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [message, setMessage] = useState("");
  const [solved, setSolved] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const items = useRef(new Map<BlockId, HTMLLIElement>());
  // Where each block was on screen just before a reorder, so it can glide to its new place.
  const before = useRef<Map<BlockId, number> | null>(null);

  function snapshot() {
    const tops = new Map<BlockId, number>();
    items.current.forEach((el, id) => tops.set(id, el.getBoundingClientRect().top));
    before.current = tops;
  }

  useLayoutEffect(() => {
    const tops = before.current;
    before.current = null;
    if (!tops || prefersReducedMotion()) return;
    items.current.forEach((el, id) => {
      const was = tops.get(id);
      if (was === undefined) return;
      const delta = was - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      el.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    });
  }, [order, drag]);

  // While dragging, the block under the pointer follows it and the others slide out of its way.
  const over = drag ? Math.max(0, Math.min(order.length - 1, drag.from + Math.round(drag.dy / drag.slot))) : -1;

  function shift(index: number, id: BlockId): number {
    if (!drag) return 0;
    if (id === drag.id) return drag.dy;
    if (drag.from < over && index > drag.from && index <= over) return -drag.slot;
    if (drag.from > over && index < drag.from && index >= over) return drag.slot;
    return 0;
  }

  // The number each block shows while dragging: where it will be if dropped now.
  function landing(index: number, id: BlockId): number {
    if (!drag) return index;
    if (id === drag.id) return over;
    const dy = shift(index, id);
    return dy > 0 ? index + 1 : dy < 0 ? index - 1 : index;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: BlockId) {
    if (solved || drag || e.button !== 0) return;
    const list = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    const slot = list.length > 1 ? list[1].getBoundingClientRect().top - list[0].getBoundingClientRect().top : e.currentTarget.offsetHeight + 8;
    // Capture can fail for a pointer the browser no longer tracks; dragging still works without it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setLifted(null);
    setDrag({ id, from: order.indexOf(id), startY: e.clientY, dy: 0, slot, pointerId: e.pointerId });
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const min = -drag.from * drag.slot - drag.slot * 0.4;
    const max = (order.length - 1 - drag.from) * drag.slot + drag.slot * 0.4;
    setDrag({ ...drag, dy: Math.max(min, Math.min(max, e.clientY - drag.startY)) });
  }

  function onPointerEnd(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    snapshot();
    if (over !== drag.from) {
      setOrder(move(order, drag.from, over));
      if (message && !solved) setMessage("");
    }
    setDrag(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, id: BlockId) {
    if (solved) return;
    const at = order.indexOf(id);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (lifted === id) {
        setLifted(null);
        setMessage(`${LABELS[id]} placed at position ${at + 1}.`);
      } else {
        setLifted(id);
        setMessage(`${LABELS[id]} picked up. Use the up and down arrows, then Space to place it.`);
      }
    } else if (e.key === "Escape" && lifted === id) {
      setLifted(null);
      setMessage(`${LABELS[id]} placed at position ${at + 1}.`);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && lifted === id) {
      e.preventDefault();
      const to = e.key === "ArrowUp" ? Math.max(0, at - 1) : Math.min(order.length - 1, at + 1);
      if (to !== at) {
        snapshot();
        setOrder(move(order, at, to));
        setMessage(`Position ${to + 1} of ${order.length}.`);
      }
    }
  }

  // One try: a wrong order is put right on screen, with the reason, and the visitor moves on.
  function check() {
    setLifted(null);
    setSolved(true);
    if (order.every((id, i) => id === RIGHT_ORDER[i])) {
      setMessage("That is the whole trip: name, address, connection, request, reply.");
      onSolved(true);
      return;
    }
    snapshot();
    setOrder([...RIGHT_ORDER]);
    setMessage("Not quite. Here is the right order: your phone needs the address from DNS before it can connect, and it can only ask for the page once it is connected.");
    onSolved(false);
  }

  return (
    <div className={s.stepBody}>
      <StepHeading eyebrow="Computer networking, chapter 3" headingRef={headingRef}>
        Put the trip in order, from Go to the page on your screen.
      </StepHeading>
      <p id="order-help" style={{ margin: 0, fontSize: "14px", color: MUTED }}>
        Drag the blocks into order.<span className={s.keyboardTip}> On a keyboard, press Space on a block, then the arrow keys.</span>
      </p>
      <ol ref={listRef} className={s.orderList} aria-describedby="order-help">
        {order.map((id, i) => {
          const held = drag?.id === id;
          const active = lifted === id || held;
          const dy = shift(i, id);
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) items.current.set(id, el);
                else items.current.delete(id);
              }}
              style={{
                position: "relative",
                zIndex: held ? 2 : 1,
                transform: dy ? `translateY(${dy}px)` : undefined,
                transition: drag && !held ? "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
              }}
            >
              <button
                type="button"
                className={s.orderBlock}
                aria-pressed={lifted === id}
                aria-label={`${LABELS[id]}, position ${i + 1} of ${order.length}`}
                disabled={solved}
                onPointerDown={(e) => onPointerDown(e, id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onKeyDown={(e) => onKeyDown(e, id)}
                onBlur={() => setLifted((l) => (l === id ? null : l))}
                style={{
                  background: solved ? TINT : "#FFFFFF",
                  border: `2px solid ${solved ? COBALT : active ? COBALT : LINE}`,
                  boxShadow: held ? "0 14px 30px rgba(10, 15, 44, 0.18)" : active ? `4px 4px 0 ${YELLOW}` : "none",
                  color: INK,
                  cursor: solved ? "default" : held ? "grabbing" : "grab",
                }}
              >
                <span aria-hidden="true" style={{ fontWeight: 700, color: COBALT, minWidth: "16px" }}>{landing(i, id) + 1}</span>
                <span style={{ flex: 1 }}>{LABELS[id]}</span>
                {!solved ? (
                  <svg aria-hidden="true" width="14" height="20" viewBox="0 0 14 20">
                    {[3, 10, 17].map((y) => (
                      <g key={y}>
                        <circle cx="4" cy={y} r="1.8" fill={MUTED} />
                        <circle cx="10" cy={y} r="1.8" fill={MUTED} />
                      </g>
                    ))}
                  </svg>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        {!solved ? (
          <button type="button" onClick={check} className={s.primary}>
            Check the order
          </button>
        ) : null}
        <p role="status" aria-live="polite" style={{ margin: 0, flex: "1 1 220px", fontSize: "15px", lineHeight: 1.5, color: solved ? INK : MUTED }}>
          {message}
        </p>
      </div>
    </div>
  );
}
