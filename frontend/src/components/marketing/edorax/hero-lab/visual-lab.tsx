"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import type { RunScore } from "@buildment/learning-ui/labs/HldBoard";
import s from "./hero-lab.module.css";

const RealVisualLab = dynamic(() => import("../try-it/real-visual-lab"), {
  ssr: false,
  loading: () => <div className={s.loading} aria-busy="true" />,
});

/** The Visual lab tab: the real system design board from the courses, tests and all. */
export function VisualLab({ onSolved }: { onSolved: () => void }) {
  const [score, setScore] = useState<RunScore | null>(null);

  return (
    <div className={s.visual}>
      <div className={s.visualBar}>
        <p className={s.visualTask}>
          The real system design board from our courses. Change the design, then press <strong>Run tests</strong>.
        </p>
        <p role="status" aria-live="polite" className={s.visualScore}>
          {score ? (score.allPass ? `All ${score.total} tests pass.` : `${score.passed} of ${score.total} tests pass. Stuck? Open Solution.`) : ""}
        </p>
        <Link href="/labs" className={s.linkLight}>
          All visual labs
        </Link>
      </div>
      <div className={s.board}>
        <RealVisualLab
          onRunDone={(result) => {
            setScore(result);
            onSolved();
          }}
        />
      </div>
    </div>
  );
}
