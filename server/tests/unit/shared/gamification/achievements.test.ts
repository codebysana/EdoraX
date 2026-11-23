import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_BY_ID, achievementProgress, rewardForTier } from "../../../../src/shared/gamification/achievements.js";
import { LEAGUE_TIER_ORDER } from "../../../../src/shared/gamification/leagues.js";
import type { LeagueTier } from "../../../../src/shared/api/gamification.js";

const league = ACHIEVEMENT_BY_ID.get("league")!;
// Mirrors services/gamification/achievements.ts: the metric value is the highest league's index.
const reached = (tier: LeagueTier) => achievementProgress(LEAGUE_TIER_ORDER.indexOf(tier), league.tiers).tier;

describe("League Climber achievement", () => {
  it("keeps four labelled tiers in ascending target order", () => {
    expect(league.tiers.map((t) => t.label)).toEqual(["Silver", "Gold", "Platinum", "Diamond"]);
    const targets = league.tiers.map((t) => t.target);
    expect([...targets].sort((a, b) => a - b)).toEqual(targets);
  });

  it("fires each tier only at its real league in the ten-tier list", () => {
    expect(reached("BRONZE")).toBe(-1);
    expect(reached("SILVER")).toBe(0);
    expect(reached("GOLD")).toBe(1);
    expect(reached("PLATINUM")).toBe(2);
  });

  it("does not award Diamond to Cobalt through Zenith", () => {
    for (const tier of ["COBALT", "JADE", "QUARTZ", "AURORA", "ZENITH"] as const) {
      expect(reached(tier)).toBe(2);
    }
    expect(reached("DIAMOND")).toBe(3);
  });

  it("keeps tier indices (and so credit ledger keys and rewards) stable for earlier learners", () => {
    // Before the ten-tier list: Silver=0, Gold=1, Platinum=2, Diamond=3 -> keys achievement:league:0..3.
    expect(league.tiers.findIndex((t) => t.label === "Diamond")).toBe(3);
    expect([0, 1, 2, 3].map(rewardForTier)).toEqual([20, 30, 40, 50]);
  });

  it("never drops a learner who reached a league under the old mapping", () => {
    // Old Silver/Gold/Platinum/Diamond holders sit at the same or higher index today.
    expect(reached("SILVER")).toBeGreaterThanOrEqual(0);
    expect(reached("GOLD")).toBeGreaterThanOrEqual(1);
    expect(reached("PLATINUM")).toBeGreaterThanOrEqual(2);
    expect(reached("DIAMOND")).toBeGreaterThanOrEqual(3);
  });
});
