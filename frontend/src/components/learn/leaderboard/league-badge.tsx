import type { LeagueTier } from "@/shared/api/gamification";
import { LEAGUE_TIER_LABELS } from "@/shared/gamification/leagues";

const TIER_COLORS: Record<LeagueTier, string> = {
  BRONZE: "#c87945",
  SILVER: "#b7c4d2",
  GOLD: "#f0b936",
  PLATINUM: "#91a8b8",
  COBALT: "#3276c8",
  JADE: "#35a77d",
  QUARTZ: "#a78bda",
  AURORA: "#5fb7bd",
  ZENITH: "#665ed0",
  DIAMOND: "#55aee8",
};

const SIZE_CLASSES = {
  sm: "size-7",
  md: "size-9",
  lg: "size-12",
} as const;

export function LeagueBadge({ tier, size = "md" }: { tier: LeagueTier; size?: keyof typeof SIZE_CLASSES }) {
  const colors = TIER_COLORS[tier];
  const label = LEAGUE_TIER_LABELS[tier];

  return (
    <svg
      role="img"
      aria-label={`${label} League`}
      viewBox="0 0 48 48"
      className={`${SIZE_CLASSES[size]} drop-shadow-[0_4px_4px_rgba(21,29,56,0.14)]`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label} League</title>
      <circle cx="24" cy="24" r="19" fill={colors} stroke="#ffffff" strokeWidth="1.5" />
      {tier === "BRONZE" ? <path d="M24 10 35 15v9c0 7-4.4 11.5-11 15-6.6-3.5-11-8-11-15v-9l11-5Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === "SILVER" ? <path d="M12 27c0-8 5-13 12-13s12 5 12 13c0 5-4 9-12 9s-12-4-12-9Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === "GOLD" ? <path d="m24 8 3.5 8 8.5.8-6.4 5.6 1.9 8.3-7.5-4.4-7.5 4.4 1.9-8.3-6.4-5.6 8.5-.8L24 8Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === "PLATINUM" ? <path d="m13 14 11-6 11 6v13l-11 6-11-6V14Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === "COBALT" ? <path d="M24 8v32M8 24h32M13 13l22 22M35 13 13 35" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" /> : null}
      {tier === "JADE" ? <path d="M34 10c-12 1-20 7-20 17 0 6 5 10 10 7 7-4 10-12 10-24Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === "QUARTZ" ? <path d="m24 7 10 9-4 19H18l-4-19 10-9Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === "AURORA" ? <path d="M9 29c5-10 10-10 15 0s10 10 15 0M9 21c5-10 10-10 15 0s10 10 15 0" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" /> : null}
      {tier === "ZENITH" ? <path d="m24 7 4 12 13 5-13 5-4 12-4-12-13-5 13-5 4-12Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === "DIAMOND" ? <path d="m24 7 12 11-12 23-12-23L24 7Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}
