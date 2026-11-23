/**
 * A party popper for finishing a whole course: two cannons at the bottom corners and a wide burst
 * from the middle. It is wider and longer than `fireMiniConfetti`, which is meant for one chapter.
 * It does nothing when the learner prefers reduced motion.
 */
const COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
const GRAVITY = 1500; // pixels per second squared
const FRAMES = 14;

type Shot = { x: number; y: number; angle: number; spread: number; count: number; power: number; delay: number };

export function firePartyPopper() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof Element.prototype.animate !== "function") return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  // Speed that carries a piece most of the way up the screen (it then falls back under gravity).
  const rise = Math.sqrt(2 * GRAVITY * height * 0.9);
  const sideSpeed = Math.max(Math.min(width, 1400) * 0.9, rise / Math.sin((62 * Math.PI) / 180));

  // A popover sits in the top layer, so the confetti shows above an open <dialog>.
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.setAttribute("popover", "manual");
  container.style.cssText = "pointer-events:none;position:fixed;inset:0;margin:0;padding:0;border:0;background:transparent;overflow:hidden;width:100vw;height:100vh;";
  document.body.appendChild(container);
  try {
    container.showPopover();
  } catch {
    container.style.zIndex = "9999";
  }

  const shots: Shot[] = [
    { x: 0, y: height, angle: -62, spread: 34, count: 70, power: sideSpeed, delay: 0 },
    { x: width, y: height, angle: -118, spread: 34, count: 70, power: sideSpeed, delay: 0 },
    { x: width / 2, y: height * 0.9, angle: -90, spread: 70, count: 60, power: rise * 1.05, delay: 260 },
  ];

  let longest = 0;
  for (const shot of shots) {
    for (let i = 0; i < shot.count; i++) {
      const angle = ((shot.angle + (Math.random() - 0.5) * shot.spread) * Math.PI) / 180;
      const speed = shot.power * (0.5 + Math.random() * 0.6);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const duration = 1900 + Math.random() * 1500;
      longest = Math.max(longest, duration + shot.delay);

      const size = 6 + Math.random() * 7;
      const piece = document.createElement("span");
      piece.style.cssText = [
        "position:absolute",
        `left:${shot.x}px`,
        `top:${shot.y}px`,
        `width:${size}px`,
        `height:${Math.random() > 0.5 ? size : size * 0.45}px`,
        `background:${COLORS[i % COLORS.length]}`,
        `border-radius:${Math.random() > 0.7 ? "50%" : "1px"}`,
        "will-change:transform,opacity",
      ].join(";");
      container.appendChild(piece);

      const spin = (Math.random() - 0.5) * 1440;
      const sway = (Math.random() - 0.5) * 60;
      const keyframes: Keyframe[] = [];
      for (let f = 0; f <= FRAMES; f++) {
        const progress = f / FRAMES;
        const t = (progress * duration) / 1000;
        // Air drag slows sideways travel, so the pieces fan out and then drift down.
        const drag = 1 - 0.55 * progress;
        const x = vx * t * drag + Math.sin(progress * 9) * sway * progress;
        const y = vy * t * drag + 0.5 * GRAVITY * t * t;
        keyframes.push({
          transform: `translate(${x}px, ${y}px) rotate(${spin * progress}deg)`,
          opacity: progress < 0.75 ? 1 : 1 - (progress - 0.75) / 0.25,
        });
      }
      piece.animate(keyframes, { duration, delay: shot.delay, easing: "linear", fill: "both" });
    }
  }

  window.setTimeout(() => container.remove(), longest + 200);
}
