import { SITE_NAME } from "@/lib/site";
import { issuedOn } from "../certificate-data";
import type { TemplateProps } from "./types";
import { BLUE, Calendar, Code, INK, MUTED, Mark, NAVY, PILL, Qr, Shield, centered, sealPath } from "./parts";

// The default design: blue and white, a navy panel on the left, a seal on the right.

function Background() {
  return (
    <svg width="1536" height="1024" viewBox="0 0 1536 1024" style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7F9FF" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EEF2FF" />
        </linearGradient>
        <linearGradient id="navy" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#13286E" />
          <stop offset="1" stopColor="#0A1642" />
        </linearGradient>
        <linearGradient id="cobalt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6C8CF5" />
          <stop offset="1" stopColor="#2F5BEA" />
        </linearGradient>
      </defs>
      <rect width="1536" height="1024" fill="url(#ground)" />
      <path d="M1100 0 H1536 V560 Q1440 380 1260 330 Q1060 270 1100 0Z" fill="#E4EBFF" opacity="0.8" />
      <path d="M1536 520 Q1420 560 1396 700 Q1380 800 1536 860Z" fill="#DCE6FF" opacity="0.9" />
      <path d="M150 330 Q300 300 270 460 Q250 600 120 700 Q40 760 0 720 V420 Q70 380 150 330Z" fill="#E6ECFF" opacity="0.9" />
      <path d="M0 0 H228 L120 300 Q70 420 70 560 Q70 760 0 840Z" fill="url(#navy)" />
      <path d="M0 150 L150 0 H196 L0 232Z" fill="#2B4BA8" opacity="0.55" />
      <path d="M0 430 Q60 300 190 250 Q120 380 90 470 Q40 540 0 560Z" fill="#2B4BA8" opacity="0.4" />
      <path d="M1536 930 L1400 1024 H1536Z" fill="url(#cobalt)" />
      <path d="M1536 800 L1260 1024 H1330 L1536 860Z" fill="#6C8CF5" opacity="0.4" />
      <path d="M0 1024 V960 Q500 930 1100 950 Q1400 960 1536 1000 V1024Z" fill="#E8EEFF" opacity="0.8" />
    </svg>
  );
}

function Seal() {
  return (
    <svg width="210" height="260" viewBox="0 0 210 260" style={{ position: "absolute", left: 1282, top: 168 }}>
      <defs>
        <linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B6CF6" />
          <stop offset="1" stopColor="#1B3FB5" />
        </linearGradient>
        <linearGradient id="disc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3C6BF4" />
          <stop offset="1" stopColor="#1A3CA8" />
        </linearGradient>
      </defs>
      <polygon points="62,150 38,246 80,222 100,252 112,160" fill="url(#ribbon)" />
      <polygon points="148,150 172,246 130,222 110,252 98,160" fill="#2552D9" />
      <path d={sealPath(105, 105, 90, 22, 5)} fill="url(#disc)" />
      <circle cx="105" cy="105" r="72" fill="#27489F" />
      <circle cx="105" cy="105" r="66" fill="#0F2468" stroke="#6C8CF5" strokeWidth="3" />
      <g transform="translate(66 80) scale(0.975)">
        <polygon points="8,36 36,8 58,8 30,36" fill="#EAF0FF" stroke="#EAF0FF" strokeWidth="8" strokeLinejoin="round" />
        <polygon points="22,54 50,26 72,26 44,54" fill="#EAF0FF" stroke="#EAF0FF" strokeWidth="8" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function EdoraxTemplate({ certificate, qr }: TemplateProps) {
  const revoked = certificate.revokedAt !== null;
  const name = certificate.recipientName;
  const nameSize = name.length > 30 ? 52 : name.length > 22 ? 64 : 80;
  const title = certificate.title;
  const titleSize = title.length > 46 ? 26 : title.length > 34 ? 32 : 38;
  const verify = certificate.verifyUrl.replace(/^https?:\/\//, "").replace(/\/verify\/.*$/, "/verify");
  const skills = certificate.skills.join(", ");
  const subtitle = certificate.issuerTitle ?? `${certificate.organization}`;

  return (
    <div style={{ display: "flex", position: "relative", width: 1536, height: 1024, fontFamily: "Poppins", color: INK, background: "#FFFFFF" }}>
      <Background />

      {/* Brand */}
      {certificate.imageData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={certificate.imageData} alt="" height={96} style={{ position: "absolute", left: 297, top: 52, height: 96, maxWidth: 380, objectFit: "contain", objectPosition: "left" }} />
      ) : (
        <div style={{ position: "absolute", left: 297, top: 60, display: "flex", alignItems: "center", gap: 22 }}>
          <Mark size={76} />
          <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: INK, letterSpacing: -1.5 }}>{SITE_NAME}</div>
        </div>
      )}
      <div style={{ position: "absolute", left: 925, top: 96, width: 294, height: 2, background: "#B9C8F2", display: "flex" }} />
      <div style={{ position: "absolute", left: 1241, top: 78, display: "flex", fontSize: 24, color: INK }}>Learn • Build • Grow</div>

      <Seal />

      {/* Heading */}
      <div style={centered(318, 186, 900)}>
        <div style={{ display: "flex", fontSize: 70, fontWeight: 700, letterSpacing: -2, color: INK }}>
          Certificate of <span style={{ color: BLUE, marginLeft: 20 }}>Completion</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 318, top: 322, width: 250, height: 2, background: "#B9C8F2", display: "flex" }} />
      <div style={{ position: "absolute", left: 972, top: 322, width: 246, height: 2, background: "#B9C8F2", display: "flex" }} />
      <div style={centered(568, 296, 404)}>
        <div style={{ display: "flex", fontSize: 34, color: MUTED }}>This is to certify that</div>
      </div>

      <div style={centered(318, 352, 900)}>
        <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, letterSpacing: -2, color: NAVY, lineHeight: 1.15 }}>{name}</div>
      </div>
      <div style={centered(318, 458, 900)}>
        <div style={{ display: "flex", fontSize: 34, color: MUTED }}>has successfully completed the course</div>
      </div>

      <div style={{ position: "absolute", left: 318, top: 524, width: 900, height: 84, borderRadius: 24, background: PILL, display: "flex", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <Code />
        <div style={{ display: "flex", width: 2, height: 46, background: "#7E96D8" }} />
        <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, color: INK, maxWidth: 690, textAlign: "center" }}>{title}</div>
      </div>

      <div style={centered(318, 632, 900)}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 28, lineHeight: 1.4, color: MUTED }}>
          <div style={{ display: "flex" }}>{certificate.program}.</div>
          <div style={{ display: "flex" }}>{skills ? `Skills: ${skills}` : "Completed every chapter and passed the AI capstone checks."}</div>
        </div>
      </div>

      {/* Facts row */}
      <div style={{ position: "absolute", left: 226, top: 764, display: "flex", alignItems: "center", gap: 18 }}>
        <Calendar />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 24, color: MUTED }}>Completed On</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: INK }}>{issuedOn(certificate.issuedAt)}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 585, top: 757, width: 2, height: 76, background: "#9DB0E6", display: "flex" }} />

      <div style={centered(620, 730, 300)}>
        <div style={{ display: "flex", fontFamily: "Signature", fontSize: 74, color: NAVY, height: 92, alignItems: "center" }}>{certificate.issuerName}</div>
      </div>
      <div style={{ position: "absolute", left: 655, top: 822, width: 245, height: 2, background: "#7E96D8", display: "flex" }} />
      <div style={centered(620, 832, 300)}>
        <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: INK }}>{certificate.issuerName}</div>
      </div>
      <div style={centered(620, 866, 300)}>
        <div style={{ display: "flex", fontSize: 23, color: MUTED }}>{subtitle}</div>
      </div>

      <div style={{ position: "absolute", left: 976, top: 757, width: 2, height: 76, background: "#9DB0E6", display: "flex" }} />
      <div style={{ position: "absolute", left: 1040, top: 764, display: "flex", alignItems: "center", gap: 22 }}>
        <Shield />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 24, color: MUTED }}>Certificate ID</div>
          <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: INK }}>{certificate.code}</div>
        </div>
      </div>

      {/* Verify */}
      {qr && qr.length > 0 ? (
        <div style={{ position: "absolute", left: 70, top: 866, display: "flex", width: 112, height: 112, borderRadius: 14, background: "#FFFFFF", overflow: "hidden" }}>
          <Qr modules={qr} size={112} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: qr && qr.length > 0 ? 204 : 70, top: 898, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>Verify at</div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: BLUE }}>{verify}</div>
      </div>

      <div style={{ position: "absolute", right: 120, top: 948, display: "flex", fontSize: 16, letterSpacing: 2.5, color: INK }}>EMPOWERING LEARNERS. BUILDING A BETTER TOMORROW.</div>

      {revoked ? (
        <div style={{ position: "absolute", left: 318, top: 400, width: 900, display: "flex", justifyContent: "center", transform: "rotate(-12deg)" }}>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 700, letterSpacing: 10, color: "#C62828", border: "10px solid #C62828", padding: "0 36px", borderRadius: 18, background: "rgba(255,255,255,0.82)" }}>WITHDRAWN</div>
        </div>
      ) : null}
    </div>
  );
}
