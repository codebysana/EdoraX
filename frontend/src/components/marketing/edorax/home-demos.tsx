import s from "./home-demos.module.css";

// Three 20-second demos of the web app, made in the same style as the desktop launch video.
// Each loads only its small poster until someone presses play.

const DEMOS = [
  {
    file: "web-visual-labs",
    title: "Visual system design labs",
    line: "Build a system for 10,000 requests a second, run the tests, then break it on purpose.",
    label: "Demo: a visual system design lab, from a design that is nearly full to four passing tests and a failed zone",
  },
  {
    file: "web-courses",
    title: "Courses you read, hear and prove",
    line: "Every lesson starts with a question. Read it or listen at any speed, then check yourself.",
    label: "Demo: a course chapter with a live diagram, the listen player and a quiz",
  },
  {
    file: "web-ai",
    title: "AI that helps you learn",
    line: "Ask about the chapter, get an AI check of your real project, and earn a certificate.",
    label: "Demo: the AI tutor answering a question, the AI capstone check and the certificate",
  },
] as const;

export function HomeDemos() {
  return (
    <section id="demos" className={s.section}>
      <div className={s.wrap}>
        <div className={s.eyebrow}>See it in 20 seconds</div>
        <h2 className={s.h2}>Watch Edorax in action.</h2>
        <ul className={s.grid}>
          {DEMOS.map((d) => (
            <li key={d.file} className={s.card}>
              <video className={s.video} controls playsInline preload="none" poster={`/video/${d.file}.webp`} width={1280} height={720} aria-label={d.label}>
                <source src={`/video/${d.file}.mp4`} type="video/mp4" />
              </video>
              <div className={s.text}>
                <h3 className={s.title}>{d.title}</h3>
                <p className={s.line}>{d.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
