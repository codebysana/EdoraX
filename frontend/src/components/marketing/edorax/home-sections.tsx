import Link from "next/link";
import type { CatalogCourseSummary } from "@/shared/api/catalog";
import { getHomeCatalog } from "@/lib/home-catalog";
import { COURSE_CATEGORY_INFO } from "@/lib/course-categories";
import { Dot } from "@/components/brand/dot";
import { CourseFilter, type CourseCard } from "./home-courses";
import { TrackPicker, type TrackView } from "./home-tracks";
import s from "./home-sections.module.css";

// The home page under the hero, built to help a visitor decide: real numbers, a role picker
// with the courses, hours and price, the top courses with a skill filter, the shell labs and
// their launch video, the certificate, pricing and the questions people ask before paying.
// Course data comes from the live catalog, so new courses show up without a code change;
// a course missing from the catalog is skipped. Catalog descriptions are never shown here
// (they open with the trainer's byline).

const SHELL_LABS = [["Linux", 19], ["Docker", 8], ["Ansible", 9], ["Kubernetes", 10]] as const;
const SHELL_LAB_COUNT = SHELL_LABS.reduce((sum, [, n]) => sum + n, 0);

const TRACKS = [
  { id: "cloud", title: "Cloud and DevOps engineer", line: "From how networks work to running real systems on AWS. Plus 46 free shell labs.", slugs: ["networking", "docker-in-practice", "terraform-in-practice", "ansible-in-practice", "aws-in-practice"] },
  { id: "ai", title: "AI engineer", line: "Build with AI, then measure it, trust it and explain it in interviews.", slugs: ["build-with-ai", "rag-eval-harness", "ai-evals-harnesses", "ai-engineering-interview"] },
  { id: "swe", title: "Software engineer", line: "Start free with the web basics, then the ideas real teams use.", slugs: ["html-foundations", "css-fundamentals", "dw-level-1", "software-engineering-concepts", "database-challenges", "system-design"] },
  { id: "career", title: "Career and communication", line: "Say it clearly, work well with people and get the call.", slugs: ["communication", "business-communication", "collaboration", "career-brand", "founder-interviews"] },
];

// Top courses, in order, each with the skill button that shows it.
const TOP: [string, string][] = [
  ["system-design", "System design"],
  ["aws-in-practice", "Cloud and DevOps"],
  ["docker-in-practice", "Cloud and DevOps"],
  ["ai-evals-harnesses", "AI engineering"],
  ["networking", "Networking"],
  ["ai-engineering-interview", "AI engineering"],
  ["communication", "People skills"],
  ["dw-level-1", "Web development"],
  ["terraform-in-practice", "Cloud and DevOps"],
  ["career-brand", "People skills"],
  ["database-challenges", "System design"],
  ["css-fundamentals", "Web development"],
  ["build-with-ai", "AI engineering"],
  ["business-communication", "People skills"],
];
const SKILLS = ["AI engineering", "Cloud and DevOps", "System design", "Networking", "Web development", "People skills"];

function isFree(c: CatalogCourseSummary) {
  return c.pricingType === "FREE" || c.priceCents === 0;
}

function priceLabel(c: CatalogCourseSummary) {
  if (isFree(c)) return "Free";
  const amount = c.priceCents / 100;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} ${c.currency}`;
}

function categoryLabel(c: CatalogCourseSummary) {
  return COURSE_CATEGORY_INFO.find((info) => info.value === c.category)?.label ?? "Course";
}

function number(n: number) {
  return n.toLocaleString("en-US");
}

function SectionHead({ eyebrow, title, line }: { eyebrow: string; title: string; line?: string }) {
  return (
    <div className={s.head}>
      <div className={s.eyebrow}>{eyebrow}</div>
      <h2 className={s.h2}>{title}</h2>
      {line ? <p className={s.line}>{line}</p> : null}
    </div>
  );
}

export async function CatalogSections() {
  const catalog = await getHomeCatalog();
  if (catalog.length === 0) return null;
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));
  const hours = catalog.reduce((sum, c) => sum + (c.estimatedHours ?? 0), 0);
  const chapters = catalog.reduce((sum, c) => sum + (c.chapterCount ?? 0), 0);

  const tracks: TrackView[] = TRACKS.map((t) => {
    const courses = t.slugs.map((slug) => bySlug.get(slug)).filter((c): c is CatalogCourseSummary => Boolean(c));
    return {
      id: t.id,
      title: t.title,
      line: t.line,
      courses: courses.map((c) => ({ slug: c.slug, title: c.title, hours: c.estimatedHours ?? 0, free: isFree(c), priceLabel: priceLabel(c) })),
      paidCents: courses.filter((c) => !isFree(c)).reduce((sum, c) => sum + c.priceCents, 0),
      currency: courses.find((c) => !isFree(c))?.currency ?? "USD",
    };
  }).filter((t) => t.courses.length >= 2);

  const cards: CourseCard[] = TOP.flatMap(([slug, skill]) => {
    const c = bySlug.get(slug);
    return c ? [{ slug, title: c.title, category: categoryLabel(c), skill, hours: c.estimatedHours ?? 0, chapters: c.chapterCount ?? 0, free: isFree(c), priceLabel: priceLabel(c) }] : [];
  });

  return (
    <>
      <section className={s.numbers} aria-label="Edorax in numbers">
        <div className={s.numbersRow}>
          <div>
            <span className={s.bigNum}>{number(catalog.length)}</span>
            <span className={s.numLabel}>courses, tech and people skills</span>
          </div>
          <div>
            <span className={s.bigNum}>{number(hours)}</span>
            <span className={s.numLabel}>hours of hands-on learning</span>
          </div>
          <div>
            <span className={s.bigNum}>{SHELL_LAB_COUNT}</span>
            <span className={s.numLabel}>shell labs on real Linux machines</span>
          </div>
          <div>
            <span className={s.bigNum}>{number(chapters)}</span>
            <span className={s.numLabel}>chapters you can read or hear</span>
          </div>
        </div>
      </section>

      <section id="tracks" className={s.section}>
        <div className={s.wrap}>
          <SectionHead eyebrow="Career tracks" title="What do you want to become?" line="Pick a role. See the courses in order, how long it takes and what it costs." />
          <TrackPicker tracks={tracks} />
        </div>
      </section>

      <section id="courses" className={`${s.section} ${s.white}`}>
        <div className={s.wrap}>
          <div className={s.headRow}>
            <SectionHead eyebrow="Top courses" title="Long, hands-on, and 10 USD." />
            <Link href="/catalog" className={s.textLink}>
              All {catalog.length} courses <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <CourseFilter courses={cards} skills={SKILLS.filter((skill) => cards.some((c) => c.skill === skill))} />
        </div>
      </section>
    </>
  );
}

/** Shown while the course list loads, so the page below the hero does not jump. */
export function CatalogSectionsFallback() {
  return <div aria-hidden="true" style={{ minHeight: "1700px" }} />;
}

export function ShellLabs() {
  return (
    <section id="labs" className={s.section}>
      <div className={`${s.wrap} ${s.split}`}>
        <div className={s.splitText}>
          <SectionHead eyebrow="Shell labs, free in the desktop app" title="A real Linux machine, on your own computer." line="Press Start. The app builds a fresh machine in Docker, you type real commands, and the checks tick themselves because they look at the machine itself." />
          <ul className={s.labCounts}>
            {SHELL_LABS.map(([name, count]) => (
              <li key={name}>
                <span className={s.labNum}>{count}</span>
                <span className={s.labName}>{name} labs</span>
              </li>
            ))}
          </ul>
          <div className={s.ctaRow}>
            <Link href="/labs/shell#download" className={s.btn}>
              Get the desktop app
            </Link>
            <span className={s.ctaNote}>Windows, macOS (Apple silicon) and Linux</span>
          </div>
        </div>
        <div className={s.splitMedia}>
          {/* The real launch video. Only the small poster loads until someone presses play. */}
          <video
            className={s.video}
            controls
            playsInline
            preload="none"
            poster="/video/edorax-desktop-labs.webp"
            width={1280}
            height={720}
            aria-label="The Edorax desktop app running a shell lab: real Linux commands, and checks that tick themselves"
          >
            <source src="/video/edorax-desktop-labs.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}

const CERT_STEPS = [
  ["Finish every chapter", "Read, play, listen and answer."],
  ["Pass the checks", "Quizzes, and the capstone check where the course has one."],
  ["Share it", "A link and QR code anyone can use to verify it, Add to LinkedIn, and a PDF."],
] as const;

export function Certificates() {
  return (
    <section id="certificates" className={`${s.section} ${s.white}`}>
      <div className={`${s.wrap} ${s.split}`}>
        <div className={s.splitText}>
          <SectionHead eyebrow="Certificates" title="Proof you did the work." line="Not a badge for showing up. Finish every chapter and pass the checks, and you get a certificate anyone can verify." />
          <ol className={s.certSteps}>
            {CERT_STEPS.map(([title, body], i) => (
              <li key={title}>
                <span className={s.certNum} aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className={s.splitMedia}>
          {/* A sample from the real certificate renderer, cached by the CDN. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.certImg} src="/certificate-preview/verified?sample=home" alt="A sample Edorax certificate of completion: the learner's name, the course, what they completed, and a verify panel with a QR code" width={1536} height={1024} loading="lazy" decoding="async" />
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className={s.section}>
      <div className={s.wrap}>
        <SectionHead eyebrow="Pricing" title="Pay for one course at a time." line="No subscription. Start free, and pay only for the course you want next." />
        <div className={s.plans}>
          <div className={s.plan}>
            <span className={s.planName}>Free</span>
            <span className={s.planPrice}>0 USD</span>
            <span className={s.planBody}>HTML, CSS and the Dev Weekends levels, plus every lab on this page.</span>
            <Link href="/catalog" className={s.btnGhost}>
              See the free courses
            </Link>
          </div>
          <div className={`${s.plan} ${s.planMain}`}>
            <span className={s.planTag}>Most learners start here</span>
            <span className={s.planName}>One course</span>
            <span className={s.planPrice}>10 USD</span>
            <span className={s.planBody}>Every chapter, the labs, the audio, the quizzes and the certificate for that course.</span>
            <a href="#courses" className={s.btnYellow}>
              Pick a course
            </a>
          </div>
          <div className={s.plan}>
            <span className={s.planName}>Shell labs</span>
            <span className={s.planPrice}>Free</span>
            <span className={s.planBody}>{SHELL_LAB_COUNT} labs on real Linux machines in the desktop app. Sign in and your progress follows you.</span>
            <a href="#labs" className={s.btnGhost}>
              Get the app
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Do I need to install anything?", "No. Courses, quizzes, the visual labs and the audio all run in your browser. Only the shell labs use the free desktop app, because they need a real Linux machine."],
  ["What does a course cost?", "Most courses are 10 USD each, and some are free. There is no subscription: you pay for one course at a time."],
  ["Can I learn on my phone?", "Yes. Courses, quizzes and audio work on a phone, and the audio files are small enough for a slow connection."],
  ["Do I get a certificate?", "Yes. Finish every chapter and pass the checks, and you get a certificate with a link anyone can verify. Add it to LinkedIn or download the PDF."],
  ["What if I get stuck?", "The shell labs have hints, the visual labs show a solution, and Dot offers a nudge, then a hint, then an example. You choose how much help you get."],
] as const;

// Native details elements: open and close with no JavaScript, so the page stays light.
export function Faq() {
  return (
    <section id="faq" className={`${s.section} ${s.white}`}>
      <div className={`${s.wrap} ${s.faqWrap}`}>
        <h2 className={s.h2}>Questions before you start</h2>
        <div className={s.faq}>
          {FAQ.map(([q, a], i) => (
            <details key={q} className={s.faqItem} open={i === 0}>
              <summary className={s.faqQ}>{q}</summary>
              <p className={s.faqA}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCall() {
  return (
    <section className={s.final}>
      <div className={s.finalWrap}>
        <div>
          <h2 className={s.finalTitle}>Start with one lab. See where it takes you.</h2>
          <p className={s.finalLine}>No account needed to try. Make one when you want to keep your progress.</p>
          <div className={s.ctaRow}>
            <Link href="/signup" className={s.btnYellow}>
              Start free
            </Link>
            <Link href="/catalog" className={s.btnLightGhost}>
              Browse courses
            </Link>
          </div>
        </div>
        <span className={s.finalDot} aria-hidden="true">
          <Dot mood="cheer" size={180} />
        </span>
      </div>
    </section>
  );
}
