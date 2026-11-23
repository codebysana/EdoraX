"use client";

import Link from "next/link";
import { useState } from "react";
import s from "./home-sections.module.css";

export type CourseCard = { slug: string; title: string; category: string; skill: string; hours: number; chapters: number; free: boolean; priceLabel: string };

/** Top courses with skill buttons that filter the cards as you click. */
export function CourseFilter({ courses, skills }: { courses: CourseCard[]; skills: string[] }) {
  const [skill, setSkill] = useState("All");
  const shown = courses.filter((c) => skill === "All" || c.skill === skill).slice(0, 8);

  return (
    <>
      <div className={s.chips} role="group" aria-label="Filter by skill">
        {["All", ...skills].map((label) => (
          <button key={label} type="button" aria-pressed={skill === label} className={skill === label ? s.chipOn : s.chip} onClick={() => setSkill(label)}>
            {label}
          </button>
        ))}
      </div>
      <ul className={s.courses} aria-live="polite">
        {shown.map((c) => (
          <li key={c.slug}>
            <Link href={`/catalog/${c.slug}`} className={s.course}>
              <span className={s.courseTop}>
                <span className={s.courseCat}>{c.category}</span>
                <span className={c.free ? s.free : s.price}>{c.priceLabel}</span>
              </span>
              <span className={s.courseTitle}>{c.title}</span>
              <span className={s.courseMeta}>
                {c.hours} hours, {c.chapters} chapters
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
