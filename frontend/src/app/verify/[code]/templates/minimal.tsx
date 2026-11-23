import { SITE_NAME } from "@/lib/site";
import { issuedOn } from "../certificate-data";
import type { TemplateProps } from "./types";
import { BLUE, INK, MUTED, Mark, Qr } from "./parts";

// Minimal: a white page, a blue edge and large left-aligned type.

export function MinimalTemplate({ certificate, qr }: TemplateProps) {
  const name = certificate.recipientName;
  const nameSize = name.length > 30 ? 64 : name.length > 22 ? 82 : 104;
  const title = certificate.title;
  const titleSize = title.length > 46 ? 34 : title.length > 34 ? 42 : 54;
  const verify = certificate.verifyUrl.replace(/^https?:\/\//, "").replace(/\/verify\/.*$/, "/verify");
  const hasQr = Boolean(qr && qr.length > 0);

  return (
    <div style={{ display: "flex", position: "relative", width: 1536, height: 1024, background: "#FFFFFF", fontFamily: "Poppins", color: INK }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 24, height: 1024, background: BLUE, display: "flex" }} />

      {certificate.imageData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={certificate.imageData} alt="" height={80} style={{ position: "absolute", left: 140, top: 80, height: 80, maxWidth: 300, objectFit: "contain", objectPosition: "left" }} />
      ) : (
        <div style={{ position: "absolute", left: 140, top: 84, display: "flex", alignItems: "center", gap: 16 }}>
          <Mark size={56} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
      )}

      <div style={{ position: "absolute", left: 140, top: 216, display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 7, color: BLUE }}>CERTIFICATE OF COMPLETION</div>
      <div style={{ position: "absolute", left: 140, top: 276, display: "flex", fontSize: 30, color: MUTED }}>This certifies that</div>
      <div style={{ position: "absolute", left: 140, top: 320, width: 1250, display: "flex", fontSize: nameSize, fontWeight: 700, letterSpacing: -3, lineHeight: 1.15 }}>{name}</div>
      <div style={{ position: "absolute", left: 140, top: 480, width: 1250, height: 2, background: "#D5DBEE", display: "flex" }} />
      <div style={{ position: "absolute", left: 140, top: 512, display: "flex", fontSize: 30, color: MUTED }}>has successfully completed</div>
      <div style={{ position: "absolute", left: 140, top: 560, width: 1250, display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
      <div style={{ position: "absolute", left: 140, top: 650, width: 1100, display: "flex", fontSize: 26, lineHeight: 1.5, color: MUTED }}>
        {certificate.skills.length ? `${certificate.program}. Skills: ${certificate.skills.join(", ")}` : `${certificate.program}. Completed every chapter and passed the AI capstone checks.`}
      </div>

      <div style={{ position: "absolute", left: 140, top: 800, display: "flex", gap: 96 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>Completed On</div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>{issuedOn(certificate.issuedAt)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "Signature", fontSize: 64, height: 52, alignItems: "center", marginTop: -8 }}>{certificate.issuerName}</div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{certificate.issuerTitle ? `${certificate.issuerName}, ${certificate.issuerTitle}` : certificate.issuerName}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>Certificate ID</div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>{certificate.code}</div>
        </div>
      </div>

      {hasQr ? (
        <div style={{ position: "absolute", left: 1262, top: 780, display: "flex", width: 140, height: 140, background: "#FFFFFF" }}>
          <Qr modules={qr!} size={140} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 140, top: 936, display: "flex", fontSize: 20, color: MUTED }}>
        {`Verify at `}<span style={{ color: BLUE, fontWeight: 700, marginLeft: 8 }}>{verify}</span>
      </div>

      {certificate.revokedAt ? (
        <div style={{ position: "absolute", left: 318, top: 400, width: 900, display: "flex", justifyContent: "center", transform: "rotate(-12deg)" }}>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 700, letterSpacing: 10, color: "#C62828", border: "10px solid #C62828", padding: "0 36px", borderRadius: 18, background: "rgba(255,255,255,0.82)" }}>WITHDRAWN</div>
        </div>
      ) : null}
    </div>
  );
}
