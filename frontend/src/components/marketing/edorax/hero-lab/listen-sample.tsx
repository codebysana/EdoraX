"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import s from "./hero-lab.module.css";

// A real chapter from a live course. The file is only fetched once a visitor presses play.
const SAMPLE = {
  course: "Cause and effect",
  chapter: "Chapter 1: Set the scene",
  minutes: 7.8,
  src: "https://audio.edorax.com/cause-and-effect/01.01-set-the-scene.mp3",
};
const SPEEDS = [0.75, 1, 1.5, 2, 3, 4] as const;

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** The Listen tab: play a real narrated chapter at any speed from 0.75x to 4x. */
export function ListenSample({ onSolved }: { onSolved: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(SAMPLE.minutes * 60);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const heard = useRef(false);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);

  // Pause when the visitor leaves the tab, so it never plays out of sight.
  useEffect(() => {
    const el = audio.current;
    return () => el?.pause();
  }, []);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = speed;
      void el.play();
    } else el.pause();
  }

  return (
    <div className={s.split}>
      <div className={s.paneTask}>
        <p className={s.eyebrow}>
          {SAMPLE.course}, {SAMPLE.chapter.toLowerCase()}
        </p>
        <p className={s.taskTitle}>Listen to the chapter instead of reading it, on a walk or on the bus.</p>
        <div className={s.player}>
          <button type="button" className={s.playButton} onClick={toggle} aria-label={playing ? "Pause" : "Play the chapter"}>
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            )}
          </button>
          <div className={s.playerTrack}>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(duration))}
              value={Math.round(time)}
              onChange={(e) => {
                const t = Number(e.target.value);
                if (audio.current) audio.current.currentTime = t;
                setTime(t);
              }}
              aria-label="Position in the chapter"
              aria-valuetext={`${clock(time)} of ${clock(duration)}`}
              className={s.range}
            />
            <div className={s.playerTimes}>
              <span>{clock(time)}</span>
              <span>{clock(duration)}</span>
            </div>
          </div>
        </div>
        <div role="group" aria-label="Speed" className={s.speeds}>
          {SPEEDS.map((v) => (
            <button key={v} type="button" aria-pressed={speed === v} className={speed === v ? s.speedOn : s.speed} onClick={() => setSpeed(v)}>
              {v}x
            </button>
          ))}
        </div>
        <audio
          ref={audio}
          src={SAMPLE.src}
          preload="none"
          onPlay={() => {
            setPlaying(true);
            if (!heard.current) {
              heard.current = true;
              onSolved();
            }
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
      </div>
      <div className={s.paneSide}>
        <ul className={s.points}>
          <li>Narrated courses you can hear, chapter by chapter.</li>
          <li>Any speed from 0.75x to 4x.</li>
          <li>Small files, about four minutes of narration per megabyte.</li>
          <li>Made for phones and slow connections.</li>
        </ul>
        <Link href="/catalog" className={s.btnSolid}>
          Browse courses
        </Link>
      </div>
    </div>
  );
}
