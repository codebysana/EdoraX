"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import s from "./start-free-menu.module.css";

// "Start free" opens a short menu of the free ways in, so a visitor picks one instead of landing
// on a sign-up form. Closes on a pick, Escape or a click outside.

const OPTIONS = [
  { href: "#lab", title: "Try a lab right here", body: "No account. Shell, visual, quiz and audio." },
  { href: "/labs", title: "Visual system design labs", body: "Build and break systems in your browser." },
  { href: "/labs/shell#download", title: "Shell labs in the desktop app", body: "Real Linux machines on your computer. Free." },
  { href: "/catalog", title: "Free courses", body: "HTML, CSS and the Dev Weekends levels." },
  { href: "/signup", title: "Create a free account", body: "Keep your progress across devices." },
] as const;

export function StartFreeMenu({ size = "large" }: { size?: "large" | "small" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={s.root}>
      <button type="button" className={size === "large" ? s.button : s.buttonSmall} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        Start free
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
      </button>
      {open ? (
        <ul className={size === "large" ? s.menu : s.menuRight}>
          {OPTIONS.map((o) => (
            <li key={o.href}>
              <Link href={o.href} className={s.item} onClick={() => setOpen(false)}>
                <span className={s.itemTitle}>{o.title}</span>
                <span className={s.itemBody}>{o.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
