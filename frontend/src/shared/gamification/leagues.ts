// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
import type { LeagueTier } from "../api/gamification";

// League tiers for the global weekly XP board, from lowest to highest. Pure helpers here so the
// server and the web app share one source of truth for badge order and zone math.

export const LEAGUE_TIER_ORDER: LeagueTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "COBALT", "JADE", "QUARTZ", "AURORA", "ZENITH", "DIAMOND"];

/** Display names for badges and banners. */
export const LEAGUE_TIER_LABELS: Record<LeagueTier, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  COBALT: "Cobalt",
  JADE: "Jade",
  QUARTZ: "Quartz",
  AURORA: "Aurora",
  ZENITH: "Zenith",
  DIAMOND: "Diamond",
};

/** Fixed weekly goals shown to learners and evaluated at the weekly settlement. */
export const LEAGUE_WEEKLY_GOALS: Record<LeagueTier, number> = {
  BRONZE: 100,
  SILVER: 200,
  GOLD: 400,
  PLATINUM: 700,
  COBALT: 1_000,
  JADE: 1_400,
  QUARTZ: 1_900,
  AURORA: 2_500,
  ZENITH: 3_200,
  DIAMOND: 4_000,
};

/** Competitive promotion is the highest ten percent of an eligible tier. */
export const LEAGUE_PROMOTION_PERCENT = 0.1;

/** Competitive rank promotion is disabled below this tier size. */
export const LEAGUE_MIN_COMPETITIVE_SIZE = 5;

export const RECOVERY_CHAPTER_TARGET = 1;
export const RECOVERY_XP_TARGET = 50;

export function leagueWeeklyGoal(tier: LeagueTier): number {
  return LEAGUE_WEEKLY_GOALS[tier];
}

export function recoveryQuestComplete(chapters: number, xp: number): boolean {
  return chapters >= RECOVERY_CHAPTER_TARGET && xp >= RECOVERY_XP_TARGET;
}

export function nextLeagueTier(tier: LeagueTier): LeagueTier | null {
  const index = LEAGUE_TIER_ORDER.indexOf(tier);
  return index >= 0 && index < LEAGUE_TIER_ORDER.length - 1 ? LEAGUE_TIER_ORDER[index + 1]! : null;
}

export function prevLeagueTier(tier: LeagueTier): LeagueTier | null {
  const index = LEAGUE_TIER_ORDER.indexOf(tier);
  return index > 0 ? LEAGUE_TIER_ORDER[index - 1]! : null;
}

/** Ranks at or better than this promote at the weekly reset. */
export function leaguePromotionZone(groupSize: number): number {
  if (groupSize < LEAGUE_MIN_COMPETITIVE_SIZE) return 0;
  return Math.max(1, Math.ceil(groupSize * LEAGUE_PROMOTION_PERCENT));
}

/** The previous percentile rule, retained for a flag-off rollback path. */
export function legacyLeaguePromotionZone(groupSize: number): number {
  if (groupSize < 3) return 0;
  return Math.max(1, Math.ceil(groupSize * 0.1));
}

/**
 * Ranks at or worse than this demote. Leagues under 10 people have no demotion zone — a small
 * board should feel safe, and loss aversion needs enough peers to be meaningful.
 */
export function leagueDemotionZone(groupSize: number, promotionZone = 0): number {
  if (groupSize < 10) return groupSize + 1;
  return Math.min(groupSize, Math.max(promotionZone + 1, Math.floor(groupSize * 0.8) + 1));
}
