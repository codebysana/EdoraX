"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { Dot } from "@/components/brand/dot";
import { ShellLab } from "./shell-lab";
import s from "./hero-lab.module.css";

// The shell lab ships with the page because it is the first thing a visitor sees. The
// other tabs load when they are opened; the visual board (the heaviest piece) only then.
const Loading = () => <div className={s.loading} aria-busy="true" />;
const QuestionStep = dynamic(() => import("../try-it/question-step").then((m) => m.QuestionStep), { loading: Loading });
const OrderStep = dynamic(() => import("../try-it/order-step").then((m) => m.OrderStep), { loading: Loading });
const ListenSample = dynamic(() => import("./listen-sample").then((m) => m.ListenSample), { loading: Loading });
const VisualLab = dynamic(() => import("./visual-lab").then((m) => m.VisualLab), { ssr: false, loading: Loading });

// Dot sits on the window and says one short thing about each tab.
const TABS = [
  { id: "shell", label: "Shell labs", mood: "think", line: "Type a command. I check it as you go." },
  { id: "visual", label: "Visual labs", mood: "wave", line: "Drag a server in, then press Run tests." },
  { id: "lesson", label: "Lesson + quiz", mood: "happy", line: "Read a little, then prove it." },
  { id: "blocks", label: "Drag blocks", mood: "wink", line: "Drag them into order." },
  { id: "listen", label: "Listen", mood: "cheer", line: "Too tired to read? Press play." },
] as const;
type TabId = (typeof TABS)[number]["id"];

const noFocus = () => {};

/**
 * The hero's lab window: one big window with a tab for each way to learn on Edorax, so a
 * visitor uses a real piece of the product before reading anything else.
 */
export function HeroLab() {
  const [tab, setTab] = useState<TabId>("shell");
  const [solved, setSolved] = useState<ReadonlySet<TabId>>(new Set());
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const index = TABS.findIndex((t) => t.id === tab);
  const next = TABS[index + 1];
  const markSolved = (id: TabId) => setSolved((prev) => new Set(prev).add(id));

  function open(id: TabId, focus = false) {
    setTab(id);
    if (focus) tabRefs.current[id]?.focus();
  }

  // Arrow keys move between tabs, as in any tab list.
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      open(TABS[e.key === "Home" ? 0 : TABS.length - 1].id, true);
    } else if (step) {
      e.preventDefault();
      open(TABS[(index + step + TABS.length) % TABS.length].id, true);
    }
  }

  let body: ReactNode;
  if (tab === "shell") body = <ShellLab onSolved={() => markSolved("shell")} />;
  else if (tab === "visual") body = <VisualLab onSolved={() => markSolved("visual")} />;
  else if (tab === "listen") body = <ListenSample onSolved={() => markSolved("listen")} />;
  else if (tab === "lesson")
    body = (
      <div className={s.split}>
        <article className={s.paneLight}>
          <p className={s.eyebrowDark}>Computer networking, chapter 3</p>
          <h3 className={s.lessonTitle}>Names are for people. Addresses are for machines.</h3>
          <p>
            When you type <strong>edorax.com</strong>, your phone has a name, not a place to send anything. Every machine on the internet is
            reached by an address, a string of numbers like 203.0.113.10.
          </p>
          <p>
            So before anything else happens, your phone asks a <strong>name server</strong> (DNS) which address goes with the name. Only with
            that answer can it connect.
          </p>
        </article>
        <div className={s.paneLight}>
          <QuestionStep onSolved={() => markSolved("lesson")} headingRef={noFocus} />
        </div>
      </div>
    );
  else
    body = (
      <div className={s.single}>
        <div className={s.singleInner}>
          <OrderStep onSolved={() => markSolved("blocks")} headingRef={noFocus} />
        </div>
      </div>
    );

  const current = TABS[index];
  return (
    <div className={s.frame}>
    <div className={s.dotPerch} aria-hidden="true">
      <span className={s.bubble}>{solved.has(tab) ? "Nice. Try the next one." : current.line}</span>
      <span className={s.dotBob}>
        <Dot mood={solved.has(tab) ? "cheer" : current.mood} size={104} />
      </span>
    </div>
    <div className={s.window} id="lab">
      <div role="tablist" aria-label="Try a way to learn" className={s.tabs} onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`lab-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="lab-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? s.tabOn : s.tab}
            onClick={() => open(t.id)}
          >
            {solved.has(t.id) ? <span aria-hidden="true" className={s.tick}>{"✓"}</span> : null}
            {t.label}
            {solved.has(t.id) ? <span className={s.srOnly}>, done</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="lab-panel" aria-labelledby={`lab-tab-${tab}`} className={s.body}>
        <div key={tab} className={s.enter}>
          {body}
        </div>
      </div>
      {solved.has(tab) && next ? (
        <div className={s.nextBar}>
          <button type="button" className={s.btnSolid} onClick={() => open(next.id, true)}>
            Next: {next.label}
            <span aria-hidden="true"> {"→"}</span>
          </button>
        </div>
      ) : null}
    </div>
    </div>
  );
}
