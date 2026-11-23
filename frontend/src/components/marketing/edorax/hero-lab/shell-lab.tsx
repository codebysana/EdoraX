"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { complete, createFileTree, displayPath, HOME, run, type RunResult, type ShellState } from "../try-it/fake-shell";
import { MONO } from "../try-it/brand";
import s from "./hero-lab.module.css";

type Effect = RunResult["effect"];

type ShellStep =
  | { kind: "task"; text: string; hint: string; command: string; check: (e: Effect) => boolean }
  | { kind: "choice"; text: string; hint: string; command: string; options: string[]; answer: string; explain: string };

// Three checks on the practice machine: two tasks the terminal checks by what the command
// did (so `ls ~` or `cat ./welcome.txt` count too), and one question answered from it.
const STEPS: readonly ShellStep[] = [
  { kind: "task", text: "Which folder are you in? Print it.", hint: "Type pwd and press Enter.", command: "pwd", check: (e) => e?.kind === "pwd" },
  {
    kind: "choice",
    text: "How many files are inside the notes folder?",
    hint: "Look inside it with ls notes.",
    command: "ls notes",
    options: ["0", "1", "2", "3"],
    answer: "1",
    explain: "notes holds one file, todo.txt.",
  },
  { kind: "task", text: "Read the welcome note in your home folder.", hint: "Type cat welcome.txt and press Enter.", command: "cat welcome.txt", check: (e) => e?.kind === "cat" && e.path === `${HOME}/welcome.txt` },
];

type Line = { id: number; kind: "in" | "out" | "err" | "ok" | "sys"; text: string };

const BOOT: Line[] = [
  { id: -2, kind: "sys", text: "edorax-lab is ready. Type help to see the commands it knows." },
];

/**
 * The Shell lab tab: the task or question on the left, a practice terminal on the right,
 * like a real Edorax shell lab. The terminal is a small pretend shell that runs in the
 * page; the real labs run on a real Linux machine in the desktop app, and the finish
 * screen says so. Nothing takes focus on page load, so the page never jumps.
 */
export function ShellLab({ onSolved }: { onSolved: () => void }) {
  const shell = useRef<ShellState>({ root: createFileTree(), cwd: HOME, history: [] });
  const nextId = useRef(0);
  const [lines, setLines] = useState<Line[]>(BOOT);
  const [value, setValue] = useState("");
  const [cwd, setCwd] = useState(HOME);
  const [step, setStep] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [panel, setPanel] = useState<"task" | "hint">("task");
  const historyAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const finished = step >= STEPS.length;
  const current = finished ? null : STEPS[step];

  useEffect(() => {
    const el = screenRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function push(kind: Line["kind"], text: string | string[]) {
    const texts = Array.isArray(text) ? text : [text];
    setLines((prev) => [...prev, ...texts.map((t) => ({ id: nextId.current++, kind, text: t }))]);
  }

  function submit(line: string = value) {
    const state = shell.current;
    push("in", `learner@edorax-lab:${displayPath(state.cwd)}$ ${line}`);
    setValue("");
    historyAt.current = null;
    if (!line.trim()) return;
    state.history.push(line.trim());
    const result = run(state, line);
    setCwd(state.cwd);
    if (result.clear) setLines([]);
    else if (result.out.length) push(result.error ? "err" : "out", result.out);
    if (current?.kind === "task" && !stepDone && current.check(result.effect)) {
      setStepDone(true);
      setRight((n) => n + 1);
      push("ok", `Check ${step + 1} passed.`);
    }
  }

  function pick(option: string) {
    if (current?.kind !== "choice" || picked) return;
    setPicked(option);
    setStepDone(true);
    if (option === current.answer) setRight((n) => n + 1);
  }

  function next() {
    const at = step + 1;
    setStep(at);
    setStepDone(false);
    setPicked(null);
    setPanel("task");
    if (at >= STEPS.length) onSolved();
  }

  function reset() {
    shell.current = { root: createFileTree(), cwd: HOME, history: [] };
    setLines(BOOT);
    setCwd(HOME);
    setValue("");
    setStep(0);
    setStepDone(false);
    setPicked(null);
    setRight(0);
    setPanel("task");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const history = shell.current.history;
    if (e.key === "Tab") {
      // Only take Tab while there is something to complete, so keyboard users can still leave.
      if (!value.trim()) return;
      e.preventDefault();
      setValue(complete(shell.current, value));
    } else if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const at = historyAt.current === null ? history.length - 1 : Math.max(0, historyAt.current - 1);
      historyAt.current = at;
      setValue(history[at]);
    } else if (e.key === "ArrowDown" && historyAt.current !== null) {
      e.preventDefault();
      const at = historyAt.current + 1;
      historyAt.current = at < history.length ? at : null;
      setValue(at < history.length ? history[at] : "");
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }

  return (
    <div className={s.split}>
      <div className={s.paneTask}>
        <div className={s.paneTabs}>
          <div role="tablist" aria-label="Task or hint" className={s.miniTabs}>
            {(["task", "hint"] as const).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={panel === p} className={panel === p ? s.miniTabOn : s.miniTab} onClick={() => setPanel(p)} disabled={finished}>
                {p === "task" ? "Task" : "Hint"}
              </button>
            ))}
          </div>
          <span className={s.counter}>
            {Math.min(step + 1, STEPS.length)} / {STEPS.length}
          </span>
        </div>
        <div className={s.dashes} aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i < step || (i === step && stepDone) ? s.dashDone : i === step ? s.dashNow : s.dash} />
          ))}
        </div>

        {finished ? (
          <div className={s.taskBody}>
            <p className={s.taskTitle}>Lab complete. {right} of {STEPS.length} right.</p>
            <p className={s.taskNote}>
              That was a practice terminal. The real shell labs run on a real Linux machine in the{" "}
              <Link href="/labs/shell#download">Edorax desktop app</Link>, with a test that checks the machine after every task.
            </p>
            <div className={s.rowButtons}>
              <Link href="/labs/shell" className={s.btnSolid}>
                See the shell labs
              </Link>
              <button type="button" className={s.btnGhost} onClick={reset}>
                Start again
              </button>
            </div>
          </div>
        ) : current ? (
          <div className={s.taskBody}>
            {panel === "hint" ? (
              <>
                <p className={s.taskTitle}>{current.hint}</p>
                <button type="button" className={s.btnGhost} onClick={() => submit(current.command)} disabled={current.kind === "task" && stepDone}>
                  Run <code style={{ fontFamily: MONO }}>{current.command}</code> for me
                </button>
              </>
            ) : (
              <p className={s.taskTitle}>{current.text}</p>
            )}

            {current.kind === "choice" && panel === "task" ? (
              <div className={s.options}>
                {current.options.map((o) => {
                  const isAnswer = picked !== null && o === current.answer;
                  const chosen = picked === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={chosen}
                      aria-disabled={picked !== null}
                      className={`${s.option} ${isAnswer ? s.optionAnswer : chosen ? s.optionChosen : ""}`}
                      onClick={() => pick(o)}
                    >
                      {o}
                      {isAnswer ? <span className={s.optionTag}>Answer</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <p role="status" aria-live="polite" className={s.taskNote}>
              {current.kind === "task"
                ? stepDone
                  ? "Passed. The terminal checked it."
                  : "Run it in the terminal. It checks your work as you go."
                : picked
                  ? picked === current.answer
                    ? `Right. ${current.explain}`
                    : `Not quite. The answer is ${current.answer}: ${current.explain}`
                  : "Use the terminal to find out, then pick an answer."}
            </p>
            {stepDone ? (
              <div>
                <button type="button" className={s.btnSolid} onClick={next}>
                  {step + 1 < STEPS.length ? "Next" : "Finish"}
                  <span aria-hidden="true"> {"→"}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={s.terminal} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
        <div className={s.termBar}>
          <span className={s.termTab}>Terminal 1</span>
          <button
            type="button"
            className={s.termReset}
            onClick={(e) => {
              e.stopPropagation();
              reset();
            }}
          >
            <span aria-hidden="true" className={s.stopSquare} />
            Reset lab
          </button>
        </div>
        <div ref={screenRef} className={s.termScreen} role="log" aria-live="polite" aria-label="Terminal output" style={{ fontFamily: MONO }}>
          {lines.map((l) => (
            <div key={l.id} className={s[`line_${l.kind}`]}>
              {l.text}
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className={s.termForm}
          >
            <span aria-hidden="true" className={s.prompt}>
              {displayPath(cwd)} $
            </span>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Type a command, then press Enter"
              placeholder={lines.length <= BOOT.length ? "type a command here" : undefined}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              className={s.termInput}
              style={{ fontFamily: MONO }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
