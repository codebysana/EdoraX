// Pieces shared by the certificate templates. Everything here is Satori friendly: flex boxes and inline SVG.

export const NAVY = "#0B1B4D";
export const INK = "#0A1240";
export const MUTED = "#4A557F";
export const BLUE = "#1F5BFF";
export const PILL = "#DCE5FB";

/** The wavy edge of the seal, as one closed path. */
export function sealPath(cx: number, cy: number, radius: number, bumps: number, depth: number): string {
  const points: string[] = [];
  for (let step = 0; step <= 240; step++) {
    const angle = (step / 240) * Math.PI * 2;
    const r = radius + depth * Math.sin(angle * bumps);
    points.push(`${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${points.join("L")}Z`;
}

export function Mark({ size, color = BLUE }: { size: number; color?: string }) {
  return (
    <svg width={size} height={(size * 62) / 80} viewBox="0 0 80 62">
      <polygon points="8,36 36,8 58,8 30,36" fill={color} stroke={color} strokeWidth="8" strokeLinejoin="round" />
      <polygon points="22,54 50,26 72,26 44,54" fill={color} stroke={color} strokeWidth="8" strokeLinejoin="round" />
    </svg>
  );
}

export function Calendar() {
  return (
    <svg width="44" height="48" viewBox="0 0 44 48">
      <rect x="3" y="8" width="38" height="36" rx="5" fill="none" stroke={BLUE} strokeWidth="3.5" />
      <rect x="3" y="8" width="38" height="10" rx="5" fill={BLUE} />
      <rect x="11" y="2" width="4" height="10" rx="2" fill={BLUE} />
      <rect x="29" y="2" width="4" height="10" rx="2" fill={BLUE} />
      {[0, 1, 2].map((row) => [0, 1, 2, 3].map((col) => <rect key={`${row}${col}`} x={9 + col * 8} y={23 + row * 7} width="4" height="4" rx="1" fill={BLUE} />))}
    </svg>
  );
}

export function Shield() {
  return (
    <svg width="46" height="52" viewBox="0 0 46 52">
      <path d="M23 3 L42 10 V25 Q42 41 23 49 Q4 41 4 25 V10Z" fill="none" stroke={BLUE} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M14 26 L21 33 L33 19" fill="none" stroke={BLUE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Code() {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40">
      <path d="M18 8 L5 20 L18 32" fill="none" stroke={BLUE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 8 L59 20 L46 32" fill="none" stroke={BLUE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 4 L28 36" fill="none" stroke={BLUE} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export function Qr({ modules, size }: { modules: boolean[][]; size: number }) {
  const count = modules.length;
  const runs: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < count) {
      if (!row[x]) { x++; continue; }
      let end = x;
      while (end < count && row[end]) end++;
      runs.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  });
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${count + 4} ${count + 4}`}>
      <rect x="-2" y="-2" width={count + 4} height={count + 4} fill="#FFFFFF" />
      <path d={runs.join("")} fill="#050B27" shapeRendering="crispEdges" />
    </svg>
  );
}

export const centered = (left: number, top: number, width: number) =>
  ({ position: "absolute", left, top, width, display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center" }) as const;

