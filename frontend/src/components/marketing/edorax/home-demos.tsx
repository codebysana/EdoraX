import s from "./home-demos.module.css";

// Three short demos filmed from the real product: the live visual lab on www.edorax.com, the course
// reader with a real course, and the live AI tutor. Each loads only its small poster until someone
// presses play.

const DEMOS = [
  {
    file: "demo-visual-labs",
    title: "Visual system design labs",
    line: "Build a short-link service from parts: run the tests, add a cache, a queue and a worker, and pass all 11 checks.",
    label: "Demo filmed on edorax.com: a visual lab going from 5 of 11 checks passing to 11 of 11",
  },
  {
    file: "demo-courses",
    title: "Courses you read, hear and prove",
    line: "Pick what you build, listen to the chapter at any speed, and answer checkpoints that tell you why.",
    label: "Demo filmed in the Edorax reader: picking a product, listening to a chapter and answering a checkpoint",
  },
  {
    file: "demo-ai",
    title: "An AI tutor for every chapter",
    line: "Ask about the chapter and get a live answer from the AI tutor, grounded in what you are reading.",
    label: "Demo filmed on edorax.com: the AI tutor answering questions about a chapter",
  },
] as const;

export function HomeDemos() {
  return (
    <section id="demos" className={s.section}>
      <div className={s.wrap}>
        <div className={s.eyebrow}>Filmed in the real product</div>
        <h2 className={s.h2}>Watch Edorax in action.</h2>
        <ul className={s.grid}>
          {DEMOS.map((d) => (
            <li key={d.file} className={s.card}>
              <video className={s.video} controls playsInline preload="none" poster={`/video/${d.file}.webp`} width={1920} height={1080} aria-label={d.label}>
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
