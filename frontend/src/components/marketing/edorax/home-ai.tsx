"use client";

import { useEffect, useRef, useState } from "react";
import { Dot } from "@/components/brand/dot";
import s from "./home-ai.module.css";

// The home page's AI section. The tutor tab is live: the visitor picks a preset question and the
// API answers it with the real chapter tutor (locked down on the server: preset ids only, cached,
// capped, saved answers as a fallback). The capstone check and mock interview tabs are clearly
// labelled examples of what the learner sees inside a course.

// The saved answers match server/src/services/ai/home-demo/service.ts. The page uses them only
// if the API cannot be reached, so a visitor always gets an answer.
const QUESTIONS = [
  {
    id: "why-address",
    text: "Why can't my phone just use the name?",
    saved: "Because the internet delivers data to addresses, not names. edorax.com is easy for people to remember, but routers only know how to move data towards an IP address, such as 203.0.113.10. So your phone first asks DNS which address goes with the name, and only then can it connect to the server and ask for the page.",
  },
  {
    id: "dns-down",
    text: "What happens if the name server is down?",
    saved: "Your phone cannot turn the name into an address, so it cannot connect, even if the website's server is working fine. The browser shows an error such as \"server not found\". Sites whose answers are already cached keep working until their time to live (TTL) runs out, which is why an outage can seem to hit some sites before others.",
  },
  {
    id: "every-time",
    text: "Is DNS asked every single time I open a site?",
    saved: "No. Each DNS answer comes with a time to live (TTL), for example 300 seconds. Your phone and the resolver keep the answer until it expires, so most page loads skip the lookup entirely. Only when the TTL runs out does your phone ask again.",
  },
  {
    id: "explain-simply",
    text: "Explain it like I'm new to this.",
    saved: "Think of what your phone does in two steps. First it asks DNS, \"What is the address for edorax.com?\" and gets back numbers such as 203.0.113.10. Then it uses that address to connect to the server and ask for the page. The name is for you; the address is what the network actually uses.",
  },
] as const;

type QuestionId = (typeof QUESTIONS)[number]["id"];
type Answer = { answer: string; live: boolean };

const TABS = [
  { id: "tutor", label: "Ask about the chapter", tag: "Live" },
  { id: "capstone", label: "AI capstone check", tag: "Example" },
  { id: "interview", label: "Mock interview", tag: "Example" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Tutor() {
  const [picked, setPicked] = useState<QuestionId | null>(null);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [shown, setShown] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  // Reveal the answer word by word, like the tutor in the reader.
  function reveal(text: string) {
    if (timer.current) window.clearInterval(timer.current);
    if (prefersReducedMotion()) {
      setShown(text);
      return;
    }
    const words = text.split(" ");
    let i = 0;
    setShown("");
    timer.current = window.setInterval(() => {
      i++;
      setShown(words.slice(0, i).join(" "));
      if (i >= words.length && timer.current) window.clearInterval(timer.current);
    }, 28);
  }

  async function ask(id: QuestionId) {
    if (loading) return;
    setPicked(id);
    setLoading(true);
    setAnswer(null);
    setShown("");
    try {
      const res = await fetch("/api/v1/public/ai-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id }),
      });
      const body = (await res.json()) as { data?: Answer };
      if (!res.ok || !body.data) throw new Error("demo failed");
      setAnswer(body.data);
      reveal(body.data.answer);
    } catch {
      const fallback = { answer: QUESTIONS.find((q) => q.id === id)!.saved, live: false };
      setAnswer(fallback);
      reveal(fallback.answer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.tutor}>
      <article className={s.lesson}>
        <p className={s.lessonEyebrow}>Networking, Hands On, chapter 3</p>
        <h3 className={s.lessonTitle}>Names are for people. Addresses are for machines.</h3>
        <p>When you type edorax.com, your phone has a name, not a place to send anything. So first it asks a name server (DNS) which address goes with the name.</p>
        <p>Answers are cached for a while, so most page loads skip the lookup.</p>
      </article>
      <div className={s.chat}>
        <p className={s.chatHint}>Pick a question. The AI tutor answers from this chapter.</p>
        <div className={s.chips} role="group" aria-label="Example questions">
          {QUESTIONS.map((q) => (
            <button key={q.id} type="button" className={picked === q.id ? s.chipOn : s.chip} aria-pressed={picked === q.id} disabled={loading} onClick={() => ask(q.id)}>
              {q.text}
            </button>
          ))}
        </div>
        <div className={s.answerBox} aria-live="polite" aria-busy={loading}>
          {picked ? (
            <>
              <p className={s.you}>{QUESTIONS.find((q) => q.id === picked)?.text}</p>
              <div className={s.reply}>
                <span className={s.replyDot} aria-hidden="true">
                  <Dot mood={loading ? "think" : "happy"} size={40} />
                </span>
                <div className={s.replyText}>
                  {loading ? <span className={s.thinking}>Thinking</span> : <p>{shown}</p>}
                  {answer && !loading ? <span className={s.badge}>{answer.live ? "Live answer from the AI tutor" : "Saved answer"}</span> : null}
                </div>
              </div>
            </>
          ) : (
            <p className={s.empty}>Your answer appears here.</p>
          )}
        </div>
        <p className={s.note}>In a course you ask your own questions about any chapter. It sticks to the chapter and never gives away quiz answers.</p>
      </div>
    </div>
  );
}

const CHECKS = ["Repository is public", "Latest CI run passed", "Required files are present", "Live site responds"];

function Capstone() {
  return (
    <div className={s.capstone}>
      <div className={s.capHead}>
        <span className={s.example}>Example result</span>
        <span className={s.repo}>github.com/[you]/errand-tracker</span>
      </div>
      <div className={s.capBody}>
        <div className={s.capChecks}>
          <p className={s.capLabel}>Automatic checks</p>
          <ul>
            {CHECKS.map((c) => (
              <li key={c}>
                <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                  <rect width="16" height="16" fill="#2434E0" />
                  <path d="M4 8.3 L7 11 L12 5.4" stroke="#F6F7FB" strokeWidth="1.8" fill="none" />
                </svg>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className={s.capReview}>
          <p className={s.capLabel}>AI review against the brief</p>
          <p className={s.capScore}>
            <span>Complete</span> 86%
          </p>
          <ol className={s.capSteps}>
            <li>Add a test for marking an errand as done twice.</li>
            <li>Show a friendly message when the list is empty.</li>
          </ol>
        </div>
      </div>
      <p className={s.note}>Submit your project repo and get a verdict in about a minute: automatic checks first, then an AI review against the brief, with numbered next steps. Pass and your certificate is issued.</p>
    </div>
  );
}

const TURNS = [
  { who: "AI interviewer", text: "You said you cached the results. Why there, and what goes stale?" },
  { who: "You", text: "The list rarely changes, so I cache it for five minutes and clear it when an errand is added." },
  { who: "AI interviewer", text: "Good. What happens if two people add an errand at the same moment?" },
];

function Interview() {
  return (
    <div className={s.interview}>
      <div className={s.capHead}>
        <span className={s.example}>Example conversation</span>
      </div>
      <ul className={s.turns}>
        {TURNS.map((t, i) => (
          <li key={i} className={t.who === "You" ? s.turnYou : s.turnAi}>
            <span className={s.turnWho}>{t.who}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
      <div className={s.report}>
        <p className={s.capLabel}>Report after the interview</p>
        <ul>
          <li>Explains trade-offs clearly</li>
          <li>Next: talk through what happens under load</li>
        </ul>
      </div>
      <p className={s.note}>A text interview that asks &quot;why&quot; until the answer is solid, then grades you against a rubric. It runs on your own AI key.</p>
    </div>
  );
}

export function HomeAi() {
  const [tab, setTab] = useState<TabId>("tutor");
  return (
    <section id="ai" className={s.section}>
      <div className={s.wrap}>
        <div className={s.head}>
          <div className={s.eyebrow}>AI built into the learning</div>
          <h2 className={s.h2}>AI that helps you learn. It never does the work for you.</h2>
          <p className={s.line}>A tutor that answers from the chapter, an AI check of your real project, and mock interviews that push back.</p>
        </div>
        <div className={s.tabs} role="tablist" aria-label="AI features">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? s.tabOn : s.tab} onClick={() => setTab(t.id)}>
              {t.label}
              <span className={t.tag === "Live" ? s.tagLive : s.tagExample}>{t.tag}</span>
            </button>
          ))}
        </div>
        <div className={s.panel} role="tabpanel">
          {tab === "tutor" ? <Tutor /> : tab === "capstone" ? <Capstone /> : <Interview />}
        </div>
      </div>
    </section>
  );
}
