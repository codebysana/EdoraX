import { readFileSync } from "node:fs";
import { join } from "node:path";
import { issuedOn } from "../certificate-data";
import type { TemplateProps } from "./types";
import { Qr } from "./parts";

// The Edorax brand design: paper ground with an ink frame, the learner's name with a yellow
// marker line, what they completed, and a cobalt panel on the right with Dot, "Verified" and the
// QR code. Brand fonts only for type (Unbounded, DM Sans); the trainer's name keeps the
// signature font. Flat colour, no gradients.

const INK = "#0A0F2C";
const MUTED = "#46507A";
const COBALT = "#2434E0";
const PAPER = "#F6F7FB";
const YELLOW = "#FFC933";
const LIGHT = "#C9CFF0";

function svgDataUri(file: string) {
  try {
    const svg = readFileSync(join(process.cwd(), "public/brand", file), "utf8");
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}

const WORDMARK = svgDataUri("edorax-wordmark.svg");

function DotCheer({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M17 58 L6 36 M83 58 L94 36" stroke={YELLOW} strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="38" cy="92" r="6" fill={INK} />
      <circle cx="62" cy="92" r="6" fill={INK} />
      <circle cx="50" cy="56" r="34" fill={YELLOW} />
      <path d="M34 52 Q40 43 46 52" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M54 52 Q60 43 66 52" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M41 64 Q50 82 59 64 Z" fill={INK} />
      <circle cx="10" cy="22" r="3" fill={YELLOW} />
      <circle cx="90" cy="14" r="3.5" fill={YELLOW} />
      <rect x="84" y="36" width="6" height="6" fill={PAPER} transform="rotate(25 87 39)" />
    </svg>
  );
}

function Tick() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16">
      <rect width="16" height="16" fill={COBALT} />
      <path d="M4 8.3 L7 11 L12 5.4" stroke={PAPER} strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function VerifiedTemplate({ certificate, qr }: TemplateProps) {
  const revoked = certificate.revokedAt !== null;
  const name = certificate.recipientName;
  const nameSize = name.length > 30 ? 54 : name.length > 22 ? 68 : 84;
  const title = certificate.title;
  const titleSize = title.length > 70 ? 28 : title.length > 46 ? 32 : 38;
  const verify = certificate.verifyUrl.replace(/^https?:\/\//, "").replace(/\/verify\/.*$/, "/verify");
  const skills = certificate.skills.join(", ");
  const done = ["Every chapter completed", "Every check passed", ...(certificate.evidence.length > 0 ? ["Capstone checked"] : [])];
  const trainer = certificate.issuerName.trim();

  return (
    <div style={{ display: "flex", position: "relative", width: 1536, height: 1024, background: PAPER, color: INK, fontFamily: "DM Sans" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 1116, height: 1024, padding: "72px 80px 64px", border: `2px solid ${INK}`, borderRight: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {certificate.imageData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={certificate.imageData} alt="" height={56} style={{ height: 56, maxWidth: 360, objectFit: "contain", objectPosition: "left" }} />
          ) : WORDMARK ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={WORDMARK} alt="" width={198} height={40} />
          ) : (
            <div style={{ display: "flex", fontFamily: "Unbounded", fontSize: 36 }}>edorax</div>
          )}
          <div style={{ display: "flex", fontSize: 18, color: MUTED, letterSpacing: 1 }}>{certificate.code}</div>
        </div>

        <div style={{ display: "flex", marginTop: 104, fontSize: 18, fontWeight: 700, letterSpacing: 2.5, color: COBALT }}>CERTIFICATE OF COMPLETION</div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 24, color: MUTED }}>This certifies that</div>
        {/* The marker line sits behind the lower part of the name, as wide as the name. */}
        <div style={{ display: "flex", position: "relative", alignSelf: "flex-start", marginTop: 10 }}>
          <div style={{ display: "flex", position: "absolute", left: -6, right: -6, bottom: Math.round(nameSize * 0.12), height: Math.round(nameSize * 0.28), background: YELLOW }} />
          <div style={{ display: "flex", fontFamily: "Unbounded", fontSize: nameSize, lineHeight: 1.15, letterSpacing: -2.5, color: INK }}>{name}</div>
        </div>
        <div style={{ display: "flex", marginTop: 44, fontSize: 24, color: MUTED }}>completed the course</div>
        <div style={{ display: "flex", marginTop: 8, maxWidth: 920, fontFamily: "Unbounded", fontSize: titleSize, lineHeight: 1.2, letterSpacing: -0.8, color: INK }}>{title}</div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 20, color: MUTED }}>{skills ? `${certificate.program}. Skills: ${skills}` : certificate.program}</div>

        <div style={{ display: "flex", marginTop: 40, gap: 32 }}>
          {done.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 700 }}>
              <Tick />
              <div style={{ display: "flex" }}>{item}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", gap: 96, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 360 }}>
            <div style={{ display: "flex", height: 64, alignItems: "flex-end", fontFamily: "Signature", fontSize: 64, color: INK }}>{trainer}</div>
            <div style={{ display: "flex", marginTop: 8, height: 2, background: INK }} />
            {trainer ? <div style={{ display: "flex", marginTop: 10, fontSize: 19, fontWeight: 700 }}>{trainer}</div> : null}
            <div style={{ display: "flex", marginTop: trainer ? 0 : 10, fontSize: 17, color: MUTED }}>{certificate.issuerTitle ?? "Course trainer"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 280 }}>
            <div style={{ display: "flex", height: 64, alignItems: "flex-end", fontSize: 26, fontWeight: 700 }}>{issuedOn(certificate.issuedAt)}</div>
            <div style={{ display: "flex", marginTop: 8, height: 2, background: INK }} />
            <div style={{ display: "flex", marginTop: 10, fontSize: 17, color: MUTED }}>Date completed</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 420, height: 1024, padding: "64px 48px", background: COBALT, color: PAPER }}>
        <DotCheer size={190} />
        <div style={{ display: "flex", marginTop: 18, fontFamily: "Unbounded", fontSize: 34, letterSpacing: -0.6 }}>{revoked ? "Withdrawn" : "Verified"}</div>
        <div style={{ display: "flex", marginTop: 6, fontSize: 19, color: LIGHT }}>by Edorax</div>
        <div style={{ display: "flex", marginTop: "auto", flexDirection: "column", alignItems: "center" }}>
          {qr && qr.length > 0 ? (
            <div style={{ display: "flex", width: 196, height: 196, padding: 14, background: "#FFFFFF" }}>
              <Qr modules={qr} size={168} />
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: 16, fontSize: 17 }}>Scan or visit</div>
          <div style={{ display: "flex", fontSize: 19, fontWeight: 700, color: YELLOW }}>{verify}</div>
        </div>
      </div>

      {revoked ? (
        <div style={{ position: "absolute", left: 120, top: 400, width: 900, display: "flex", justifyContent: "center", transform: "rotate(-12deg)" }}>
          <div style={{ display: "flex", fontSize: 140, fontWeight: 700, letterSpacing: 10, color: "#B42318", border: "10px solid #B42318", padding: "0 36px", background: "rgba(246,247,251,0.85)" }}>WITHDRAWN</div>
        </div>
      ) : null}
    </div>
  );
}
