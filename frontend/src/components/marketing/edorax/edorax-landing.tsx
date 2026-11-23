import Link from "next/link";
import { Suspense } from "react";
import { HeroLab } from "./hero-lab/hero-lab";
import { HomeAi } from "./home-ai";
import { HomeDemos } from "./home-demos";
import { StartFreeMenu } from "./start-free-menu";
import { CatalogSections, CatalogSectionsFallback, Certificates, Faq, FinalCall, Pricing, ShellLabs } from "./home-sections";
import { Wordmark } from "@/components/brand/wordmark";
import s from "./edorax-landing.module.css";

// The Edorax home page. Static markup with inline brand values so it matches the
// approved design one to one; only the hero's lab window is interactive. The sections
// under it, some of them fed by the live catalog, live in home-sections.tsx. Font variables (--font-unbounded, --font-dm-sans) are defined
// globally in layout.tsx.

function AccountLink({ dashboardHref }: { dashboardHref: string | null }) {
  return <Link href={dashboardHref ?? "/login"} style={{ color: "#0A0F2C", textDecoration: "none", fontWeight: 700, padding: "12px 0", whiteSpace: "nowrap" }}>{dashboardHref ? "Dashboard" : "Sign in"}</Link>;
}

// Courses are public, so the nav links to the catalog on every screen size, phones included.
function CoursesNavLink() {
  return <Link href="/catalog" style={{ color: "#0A0F2C", textDecoration: "none", fontWeight: 700, padding: "12px 0", whiteSpace: "nowrap" }}>Courses</Link>;
}

function LabsNavLink() {
  return <Link href="/labs" className={s.navLink} style={{ color: "#0A0F2C", textDecoration: "none", fontWeight: 700, padding: "12px 0", whiteSpace: "nowrap" }}>Labs</Link>;
}


export function EdoraxLanding({ dashboardHref = null }: { dashboardHref?: string | null }) {
  return (
    <div className={s.root} style={{ width: "100%", boxSizing: "border-box", background: "#F6F7FB", color: "#0A0F2C", fontFamily: "var(--font-dm-sans), system-ui, sans-serif", fontSize: "18px", lineHeight: "1.55" }}>
      <div style={{ width: "100%", background: "#F6F7FB", color: "#0A0F2C" }}>
        <header style={{ width: "100%" }}>
          <div className={s.header} style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 24px", boxSizing: "border-box", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <a href="#top" aria-label="Edorax home" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
              <Wordmark tone="light" height={30} />
            </a>
            <nav aria-label="Main" className={s.nav} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 28px", fontSize: "16px" }}>
              <a href="#tracks" className={s.navLink} style={{ color: "#0A0F2C", textDecoration: "none", padding: "12px 0" }}>Career tracks</a>
              <a href="#ai" className={s.navLink} style={{ color: "#0A0F2C", textDecoration: "none", padding: "12px 0" }}>AI</a>
              <a href="#labs" className={s.navLink} style={{ color: "#0A0F2C", textDecoration: "none", padding: "12px 0" }}>Shell labs</a>
                            <a href="#pricing" className={s.navLink} style={{ color: "#0A0F2C", textDecoration: "none", padding: "12px 0" }}>Pricing</a>
              <CoursesNavLink />
              <LabsNavLink />
              <AccountLink dashboardHref={dashboardHref} />
              <span className={s.hideSm}>
                <StartFreeMenu size="small" />
              </span>
            </nav>
          </div>
        </header>
        <section id="top" style={{ width: "100%" }}>
          <div className={s.hero} style={{ maxWidth: "1200px", margin: "0 auto", padding: "44px 24px 88px", boxSizing: "border-box", textAlign: "center" }}>
            <h1 className={s.h1} style={{ margin: "0", fontFamily: "var(--font-unbounded), sans-serif", fontWeight: "700", fontSize: "68px", lineHeight: "1.04", letterSpacing: "-0.04em" }}>
              Run it. Break it. <span style={{ boxShadow: "inset 0 -0.3em 0 #FFC933" }}>Learn it.</span>
            </h1>
            <p className={s.heroLead} style={{ margin: "22px auto 0", fontSize: "20px", color: "#46507A", maxWidth: "700px", textWrap: "balance" }}>Real shell labs, a system design board you can break, and courses you can read or hear. Try one right here before you pay a thing.</p>
            <div className={s.heroCtas} style={{ marginTop: "32px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px" }}>
              <StartFreeMenu />
              <a href="#tracks" style={{ color: "#0A0F2C", textDecoration: "none", fontWeight: "700", padding: "13px 28px", border: "2px solid #0A0F2C" }}>Find your track</a>
            </div>
            <ul className={s.ticks} aria-label="What you get" style={{ listStyle: "none", margin: "24px 0 0", padding: "0", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 24px", fontSize: "15px", color: "#46507A" }}>
              {["No account to try", "Free courses to start", "10 USD a course, no subscription"].map((t) => (
                <li key={t} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="8" fill="#2434E0" />
                    <path d="M4.5 8.3 L7 10.6 L11.5 5.6" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
            <div className={s.labWrap} style={{ marginTop: "120px" }}>
              <HeroLab />
            </div>
          </div>
        </section>
      </div>
      <Suspense fallback={<CatalogSectionsFallback />}>
        <CatalogSections />
      </Suspense>
      <HomeDemos />
      <HomeAi />
      <ShellLabs />
      <Certificates />
      <Pricing />
      <Faq />
      <FinalCall />
      <footer style={{ width: "100%", background: "#0A0F2C", color: "#C9CFF0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "44px 24px 36px", boxSizing: "border-box", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
          <div>
            <Wordmark tone="dark" height={26} />
          </div>
          <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "4px 28px", fontSize: "15px" }}>
            <a href="#tracks" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Career tracks</a>
            <a href="#courses" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Top courses</a>
            <a href="#ai" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>AI</a>
            <a href="#labs" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Shell labs</a>
            <a href="#certificates" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Certificates</a>
            <a href="#pricing" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Pricing</a>
            <a href="#faq" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Questions</a>
            <Link href="/catalog" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Courses</Link>
            <Link href="/labs" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>Labs</Link>
            <Link href="/learn" style={{ color: "#C9CFF0", textDecoration: "none", padding: "10px 0" }}>All areas</Link>
            <span style={{ padding: "10px 0" }}>edorax.com</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
