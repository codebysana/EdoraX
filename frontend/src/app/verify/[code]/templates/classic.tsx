import { SITE_NAME } from "@/lib/site";
import { issuedOn } from "../certificate-data";
import type { TemplateProps } from "./types";
import { Mark, Qr, centered, sealPath } from "./parts";

// Classic: cream paper, a gold double border and serif type. Calm and formal.

const PAPER = "#FBF6EA";
const GOLD = "#B08D3C";
const GOLD_LIGHT = "#D9BC6F";
const INK = "#1B2540";
const MUTED = "#5B6482";
const SERIF = "Libre Baskerville";

function GoldSeal() {
  return (
    <svg width="190" height="230" viewBox="0 0 210 260" style={{ position: "absolute", left: 673, top: 690 }}>
      <polygon points="62,150 38,246 80,222 100,252 112,160" fill="#8F6F27" />
      <polygon points="148,150 172,246 130,222 110,252 98,160" fill="#A8873A" />
      <path d={sealPath(105, 105, 90, 24, 5)} fill={GOLD} />
      <circle cx="105" cy="105" r="72" fill={GOLD_LIGHT} />
      <circle cx="105" cy="105" r="64" fill="none" stroke="#8F6F27" strokeWidth="3" />
      <g transform="translate(66 80) scale(0.975)">
        <polygon points="8,36 36,8 58,8 30,36" fill="#7A5C1C" stroke="#7A5C1C" strokeWidth="8" strokeLinejoin="round" />
        <polygon points="22,54 50,26 72,26 44,54" fill="#7A5C1C" stroke="#7A5C1C" strokeWidth="8" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function ClassicTemplate({ certificate, qr }: TemplateProps) {
  const name = certificate.recipientName;
  const nameSize = name.length > 30 ? 52 : name.length > 22 ? 64 : 80;
  const title = certificate.title;
  const titleSize = title.length > 46 ? 30 : title.length > 34 ? 36 : 44;
  const verify = certificate.verifyUrl.replace(/^https?:\/\//, "").replace(/\/verify\/.*$/, "/verify");
  const hasQr = Boolean(qr && qr.length > 0);

  return (
    <div style={{ display: "flex", position: "relative", width: 1536, height: 1024, background: PAPER, fontFamily: SERIF, color: INK }}>
      <div style={{ position: "absolute", left: 36, top: 36, width: 1464, height: 952, border: `4px solid ${GOLD}`, display: "flex" }} />
      <div style={{ position: "absolute", left: 58, top: 58, width: 1420, height: 908, border: `1.5px solid ${INK}`, display: "flex" }} />

      {certificate.imageData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={certificate.imageData} alt="" height={80} style={{ position: "absolute", left: 618, top: 84, height: 80, maxWidth: 300, objectFit: "contain" }} />
      ) : (
        <div style={centered(468, 92, 600)}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Mark size={58} color={GOLD} />
            <div style={{ display: "flex", fontFamily: "Poppins", fontSize: 42, fontWeight: 700, color: INK, letterSpacing: -1 }}>{SITE_NAME}</div>
          </div>
        </div>
      )}

      <div style={centered(168, 196, 1200)}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: 8, color: INK }}>CERTIFICATE OF COMPLETION</div>
      </div>
      <div style={{ position: "absolute", left: 568, top: 268, width: 400, height: 2, background: GOLD, display: "flex" }} />

      <div style={centered(168, 296, 1200)}>
        <div style={{ display: "flex", fontSize: 26, color: MUTED }}>This is to certify that</div>
      </div>
      <div style={centered(168, 346, 1200)}>
        <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{name}</div>
      </div>
      <div style={{ position: "absolute", left: 368, top: 462, width: 800, height: 2, background: GOLD, display: "flex" }} />

      <div style={centered(168, 486, 1200)}>
        <div style={{ display: "flex", fontSize: 26, color: MUTED }}>has successfully completed the course</div>
      </div>
      <div style={centered(218, 540, 1100)}>
        <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, color: INK, textAlign: "center" }}>{title}</div>
      </div>
      <div style={centered(268, 620, 1000)}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 22, lineHeight: 1.6, color: MUTED }}>
          <div style={{ display: "flex" }}>{certificate.program}</div>
          <div style={{ display: "flex" }}>{certificate.skills.length ? `Skills: ${certificate.skills.join(", ")}` : "Completed every chapter and passed the AI capstone checks."}</div>
        </div>
      </div>

      <GoldSeal />

      <div style={{ position: "absolute", left: 200, top: 726, display: "flex", flexDirection: "column", alignItems: "center", width: 320 }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: INK, height: 56, alignItems: "center" }}>{issuedOn(certificate.issuedAt)}</div>
        <div style={{ display: "flex", width: 260, height: 2, background: INK }} />
        <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 10 }}>Completed On</div>
      </div>

      <div style={{ position: "absolute", left: 1016, top: 700, display: "flex", flexDirection: "column", alignItems: "center", width: 320 }}>
        <div style={{ display: "flex", fontFamily: "Signature", fontSize: 72, color: INK, height: 86, alignItems: "center" }}>{certificate.issuerName}</div>
        <div style={{ display: "flex", width: 260, height: 2, background: INK }} />
        <div style={{ display: "flex", fontSize: 22, fontWeight: 700, marginTop: 10 }}>{certificate.issuerName}</div>
        <div style={{ display: "flex", fontSize: 18, color: MUTED }}>{certificate.issuerTitle ?? certificate.organization}</div>
      </div>

      {hasQr ? (
        <div style={{ position: "absolute", left: 100, top: 850, display: "flex", width: 96, height: 96, background: "#FFFFFF" }}>
          <Qr modules={qr!} size={96} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: hasQr ? 214 : 100, top: 872, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 17, color: MUTED }}>{`Certificate ID ${certificate.code}`}</div>
        <div style={{ display: "flex", fontSize: 17, color: GOLD, fontWeight: 700 }}>{`Verify at ${verify}`}</div>
      </div>

      {certificate.revokedAt ? (
        <div style={{ position: "absolute", left: 318, top: 400, width: 900, display: "flex", justifyContent: "center", transform: "rotate(-12deg)" }}>
          <div style={{ display: "flex", fontFamily: "Poppins", fontSize: 150, fontWeight: 700, letterSpacing: 10, color: "#C62828", border: "10px solid #C62828", padding: "0 36px", borderRadius: 18, background: "rgba(255,255,255,0.82)" }}>WITHDRAWN</div>
        </div>
      ) : null}
    </div>
  );
}
