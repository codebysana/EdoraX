import type { LeaguePlacement as LeaguePlacementRow, Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../db/prisma.js";
import { LEAGUE_TIERS, type LeagueOutcome, type LeagueTier } from "../../shared/api/gamification.js";
import { dateToDayKey, dayKeyToDate, shiftDayKey } from "../../shared/lib/local-date.js";
import {
  leagueDemotionZone,
  leaguePromotionZone,
  leagueWeeklyGoal,
  legacyLeaguePromotionZone,
  nextLeagueTier,
  prevLeagueTier,
  recoveryQuestComplete,
} from "../../shared/gamification/leagues.js";
import { currentLeaderboardWeek, loadListableLearners } from "./leaderboard.js";
import { gamificationFeatures } from "./flags.js";
import { LEAGUE_PROMOTION_CREDITS, creditKeys, earnCredits } from "./credits.js";
import { LEAGUE_SHIELD_REWARD } from "../../shared/gamification/rewards.js";

// Global weekly XP leagues. Every opted-in learner sits in one of ten tiers from Bronze to Diamond; at the
// Monday 00:00 UTC reset the week's global XP ranks each tier. Learners can promote by finishing
// in the top 10% when the tier has at least five eligible learners, or by reaching the tier's
// published XP goal.
//
// The reset is idempotent: LeaguePlacement rows for a week are the marker, and the whole write
// runs under one advisory lock so two schedulers cannot settle the same week twice.

type Tx = Prisma.TransactionClient;
type RankedLearner = { userId: string; tier: LeagueTier; xp: number; createdAt: Date };

export type LeagueResetResult = { weekKey: string; promoted: number; demoted: number; held: number };

/** The Monday (UTC) of the week that just closed, relative to `now`. */
export function previousLeagueWeek(now: Date = new Date()): Date {
  return dayKeyToDate(shiftDayKey(dateToDayKey(currentLeaderboardWeek(now)), -7));
}

function tierIndex(tier: LeagueTier): number {
  return LEAGUE_TIERS.indexOf(tier);
}

/** Settles one closed week: ranks every tier by global XP, moves learners, records placements. */
export async function resetLeaguesForWeek(weekKey: Date): Promise<LeagueResetResult> {
  const result = { weekKey: dateToDayKey(weekKey), promoted: 0, demoted: 0, held: 0 };
  const alreadySettled = await prisma.leaguePlacement.count({ where: { weekKey } });
  if (alreadySettled > 0) return result;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('leaderboard-league-reset'))`;
    const claimed = await tx.leaguePlacement.count({ where: { weekKey } });
    if (claimed > 0) return result;

    const weekly = await tx.xpEntry.groupBy({
      by: ["userId"],
      where: { weekKey },
      _sum: { amount: true },
    });
    const xpByUser = new Map(weekly.map((row) => [row.userId, row._sum.amount ?? 0]));

    const learners = await loadListableLearners(tx);
    const enrollmentToUser = new Map<string, string>();
    for (const learner of learners) {
      for (const enrollmentId of learner.enrollmentIds) enrollmentToUser.set(enrollmentId, learner.userId);
    }
    const recoveryChapters = new Map<string, number>();
    if (gamificationFeatures().recovery && enrollmentToUser.size > 0) {
      const completed = await tx.chapterProgress.groupBy({
        by: ["enrollmentId"],
        where: {
          enrollmentId: { in: [...enrollmentToUser.keys()] },
          status: "COMPLETED",
          completedAt: { gte: weekKey, lt: new Date(weekKey.getTime() + 7 * 86_400_000) },
        },
        _count: { _all: true },
      });
      for (const row of completed) {
        const userId = enrollmentToUser.get(row.enrollmentId);
        if (userId) recoveryChapters.set(userId, (recoveryChapters.get(userId) ?? 0) + row._count._all);
      }
    }
    const byTier = new Map<LeagueTier, RankedLearner[]>();
    for (const learner of learners) {
      const rows = byTier.get(learner.leagueTier) ?? [];
      rows.push({ userId: learner.userId, tier: learner.leagueTier, xp: xpByUser.get(learner.userId) ?? 0, createdAt: learner.createdAt });
      byTier.set(learner.leagueTier, rows);
    }

    // League shields: a learner in the demotion zone with a shield held holds their tier instead of
    // demoting, and the shield is consumed. Quantities are preloaded so consumption is one pass.
    const shields = new Map(
      (await tx.rewardInventory.findMany({ where: { rewardId: LEAGUE_SHIELD_REWARD, quantity: { gt: 0 } } })).map(
        (row) => [row.userId, row.quantity]
      )
    );
    const shieldHolders = new Set<string>();

    const placements: Prisma.LeaguePlacementCreateManyInput[] = [];
    const moves = new Map<LeagueTier, string[]>();
    const promoted: string[] = [];
    const features = gamificationFeatures();
    for (const [tier, rows] of byTier) {
      rows.sort((a, b) => b.xp - a.xp || a.createdAt.getTime() - b.createdAt.getTime());
      const promotionZone = features.leagueTiers ? leaguePromotionZone(rows.length) : legacyLeaguePromotionZone(rows.length);
      const demotionZone = leagueDemotionZone(rows.length, promotionZone);
      const goal = features.leagueTiers ? leagueWeeklyGoal(tier) : null;
      rows.forEach((row, index) => {
        const rank = index + 1;
        let outcome: LeagueOutcome = "HELD";
        let tierAfter = tier;
        const competitivePromotion = rank <= promotionZone && tierIndex(tier) < LEAGUE_TIERS.length - 1;
        const targetPromotion = goal !== null && row.xp >= goal && tierIndex(tier) < LEAGUE_TIERS.length - 1;
        if (competitivePromotion || targetPromotion) {
          outcome = competitivePromotion && targetPromotion ? "PROMOTED_BOTH" : targetPromotion ? "PROMOTED_TARGET" : "PROMOTED";
          tierAfter = nextLeagueTier(tier)!;
        } else if (rank >= demotionZone && tierIndex(tier) > 0) {
          const recoveryHeld = features.recovery && recoveryQuestComplete(recoveryChapters.get(row.userId) ?? 0, xpByUser.get(row.userId) ?? 0);
          if (recoveryHeld) {
            outcome = "RECOVERY_HELD";
          } else if ((shields.get(row.userId) ?? 0) > 0) {
            outcome = "SHIELD_HELD";
            shieldHolders.add(row.userId);
          } else {
            outcome = "DEMOTED";
            tierAfter = prevLeagueTier(tier)!;
          }
        }
        if (outcome === "PROMOTED" || outcome === "PROMOTED_TARGET" || outcome === "PROMOTED_BOTH") result.promoted += 1;
        else if (outcome === "DEMOTED") result.demoted += 1;
        else result.held += 1;
        if (outcome === "PROMOTED" || outcome === "PROMOTED_TARGET" || outcome === "PROMOTED_BOTH") promoted.push(row.userId);
        placements.push({ userId: row.userId, weekKey, tier, rank, xp: row.xp, outcome });
        if (tierAfter !== tier) {
          const ids = moves.get(tierAfter) ?? [];
          ids.push(row.userId);
          moves.set(tierAfter, ids);
        }
      });
    }

    // Consume one shield per protected learner.
    if (shieldHolders.size > 0) {
      await tx.rewardInventory.updateMany({ where: { rewardId: LEAGUE_SHIELD_REWARD, userId: { in: [...shieldHolders] }, quantity: { gt: 0 } }, data: { quantity: { decrement: 1 } } });
      await tx.rewardInventory.deleteMany({ where: { rewardId: LEAGUE_SHIELD_REWARD, quantity: { lte: 0 } } });
    }

    for (const [tier, userIds] of moves) {
      await tx.user.updateMany({ where: { id: { in: userIds } }, data: { leagueTier: tier } });
    }
    if (placements.length > 0) {
      await tx.leaguePlacement.createMany({ data: placements });
    }
    // A promoted learner earns Build Credits; keyed by week so each promotion pays once.
    if (gamificationFeatures().credits && promoted.length > 0) {
      const weekKeyStr = dateToDayKey(weekKey);
      for (const userId of promoted) {
        await earnCredits(tx, userId, creditKeys.leaguePromotion(weekKeyStr), LEAGUE_PROMOTION_CREDITS);
      }
    }
    return result;
  });
}

/** The learner's settled outcome for a given week, if any. */
export async function loadLeaguePlacement(userId: string, weekKey: Date, db: Tx | typeof prisma = prisma): Promise<LeaguePlacementRow | null> {
  return db.leaguePlacement.findUnique({ where: { userId_weekKey: { userId, weekKey } } });
}
