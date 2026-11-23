"use client";

import Link from "next/link";
import { useState } from "react";
import s from "./home-sections.module.css";

export type TrackCourse = { slug: string; title: string; hours: number; free: boolean; priceLabel: string };
export type TrackView = { id: string; title: string; line: string; courses: TrackCourse[]; paidCents: number; currency: string };

function money(cents: number, currency: string) {
  const amount = cents / 100;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} ${currency}`;
}

/** "What do you want to become?": pick a role and see its courses, hours and total price. */
export function TrackPicker({ tracks }: { tracks: TrackView[] }) {
  const [id, setId] = useState(tracks[0]?.id);
  const track = tracks.find((t) => t.id === id) ?? tracks[0];
  if (!track) return null;
  const hours = track.courses.reduce((sum, c) => sum + c.hours, 0);
  const paid = track.courses.filter((c) => !c.free).length;
  const free = track.courses.length - paid;

  return (
    <div className={s.picker}>
      <div className={s.roles} role="radiogroup" aria-label="Pick a role">
        {tracks.map((t) => {
          const on = t.id === track.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} className={on ? s.roleOn : s.role} onClick={() => setId(t.id)}>
              <span className={s.roleTitle}>{t.title}</span>
              <span className={s.roleMeta}>
                {t.courses.length} courses, {t.courses.reduce((sum, c) => sum + c.hours, 0)} hours
              </span>
            </button>
          );
        })}
      </div>
      <div className={s.trackCard} aria-live="polite">
        <div className={s.trackHead}>
          <div>
            <h3 className={s.trackTitle}>{track.title}</h3>
            <p className={s.trackLine}>{track.line}</p>
          </div>
          <div className={s.trackPrice}>
            <span className={s.trackPriceBig}>{money(track.paidCents, track.currency)}</span>
            <span className={s.trackPriceNote}>{free ? `${free} free, ${paid} paid` : `for all ${paid} courses`}</span>
          </div>
        </div>
        <ol className={s.trackList}>
          {track.courses.map((c, i) => (
            <li key={c.slug}>
              <span className={s.trackNum} aria-hidden="true">
                {i + 1}
              </span>
              <Link href={`/catalog/${c.slug}`} className={s.trackCourse}>
                {c.title}
              </Link>
              <span className={s.trackHours}>{c.hours} h</span>
              <span className={c.free ? s.free : s.trackCoursePrice}>{c.priceLabel}</span>
            </li>
          ))}
        </ol>
        <div className={s.trackFoot}>
          <span>
            {track.courses.length} courses, about {hours} hours
          </span>
          <Link href={`/catalog/${track.courses[0].slug}`} className={s.btn}>
            Start with course 1 <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
