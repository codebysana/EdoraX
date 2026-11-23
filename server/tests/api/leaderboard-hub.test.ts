import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/db/prisma.js";
import { awardXp } from "../../src/services/gamification/xp.js";
import { currentLeaderboardWeek } from "../../src/services/gamification/leaderboard.js";
import { previousLeagueWeek, resetLeaguesForWeek } from "../../src/services/gamification/league.js";
import { dateToDayKey, dayKeyToDate, shiftDayKey } from "../../src/shared/lib/local-date.js";
import { createCourseFixture } from "../helpers/fixtures.js";
import type { LeagueTier } from "../../src/shared/api/gamification.js";

const app = createApp();
let fx: Awaited<ReturnType<typeof createCourseFixture>>;
const extraUserIds: string[] = [];
let optedInBefore: Array<{ id: string; leaderboardOptIn: boolean }> = [];
const flags = {
  GAMIFICATION_XP: env.GAMIFICATION_XP,
  GAMIFICATION_LEADERBOARDS: env.GAMIFICATION_LEADERBOARDS,
  GAMIFICATION_LEAGUE_TIERS: env.GAMIFICATION_LEAGUE_TIERS,
  GAMIFICATION_RECOVERY: env.GAMIFICATION_RECOVERY,
};

beforeAll(async () => {
  optedInBefore = await prisma.user.findMany({ where: { leaderboardOptIn: true }, select: { id: true, leaderboardOptIn: true } });
  await prisma.user.updateMany({ where: { leaderboardOptIn: true }, data: { leaderboardOptIn: false } });
  fx = await createCourseFixture();
});
afterEach(() => Object.assign(env, flags));
afterAll(async () => {
  await fx.cleanup();
  for (const user of optedInBefore) {
    await prisma.user.update({ where: { id: user.id }, data: { leaderboardOptIn: user.leaderboardOptIn } });
  }
});

const auth = (token = fx.learnerToken) => ({ Authorization: `Bearer ${token}` });
const hub = (params: string, token = fx.learnerToken) => request(app).get(`/api/v1/learner/leaderboards?${params}`).set(auth(token));

async function optedInLearner(name: string, options: { leagueTier?: LeagueTier } = {}) {
  const user = await prisma.user.create({
    data: {
      email: `hub-${name.toLowerCase().replace(/\W/g, "")}-${fx.tag}-${extraUserIds.length}@test.local`,
      name,
      role: "MENTEE",
      emailVerified: new Date(),
      leaderboardOptIn: true,
      leagueTier: options.leagueTier ?? "BRONZE",
    },
  });
  extraUserIds.push(user.id);
  const enrollment = await prisma.enrollment.create({
    data: { courseId: fx.course.id, userId: user.id, lifecycle: "ACTIVE", status: "IN_PROGRESS", source: "DIRECT", startedAt: new Date() },
  });
  return { user, enrollment };
}

async function award(userId: string, enrollmentId: string, amount: number, sourceKey: string, at: Date = new Date()) {
  await prisma.$transaction((tx) =>
    awardXp(tx, { userId, enrollmentId, courseId: fx.course.id, source: "chapter_completed", sourceKey: `hub:${fx.tag}:${sourceKey}`, amount, at })
  );
}

async function clearPlacementMarker(weekKey: Date) {
  await prisma.leaguePlacement.deleteMany({ where: { weekKey } });
}

// Each test starts from a clean board: extra learners are deleted and the fixture learner is opted
// back out, so ranks and group sizes stay deterministic within a test.
afterEach(async () => {
  await prisma.leaguePlacement.deleteMany({ where: { userId: { in: [fx.learner.id, ...extraUserIds] } } });
  await prisma.user.update({ where: { id: fx.learner.id }, data: { leaderboardOptIn: false } });
  await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
  extraUserIds.length = 0;
});

describe("leaderboard hub", () => {
  it("asks for opt-in on global boards, then ranks this week's global XP inside the learner's league", async () => {
    expect((await hub("category=weekly_xp&scope=global")).body.data).toMatchObject({ status: "opt_in_required", category: "weekly_xp", scope: "global" });

    const ada = await optedInLearner("Ada Lovelace");
    await award(ada.user.id, ada.enrollment.id, 100, "ada");
    await prisma.user.update({ where: { id: fx.learner.id }, data: { leaderboardOptIn: true } });
    await award(fx.learner.id, fx.enrollment.id, 50, "viewer");

    const view = (await hub("category=weekly_xp&scope=global")).body.data;
    expect(view.status).toBe("ready");
    expect(view).toMatchObject({
      category: "weekly_xp",
      scope: "global",
      metricLabel: "XP",
      groupSize: 2,
      weekStart: dateToDayKey(currentLeaderboardWeek()),
      you: { rank: 2, score: 50, bestScore: 0 },
      league: {
        tier: "BRONZE",
        rank: 2,
        groupSize: 2,
        promotionZone: 0,
        demotionZone: 3,
        goal: 100,
        goalMet: false,
        inPromotionZone: false,
        promotionPath: null,
        recovery: { chapters: 0, chapterTarget: 1, xp: 50, xpTarget: 50, completed: false },
        lastWeek: null,
      },
    });
    expect(view.entries.map((entry: { rank: number; name: string; score: number; isYou: boolean }) => [entry.rank, entry.name, entry.score, entry.isYou])).toEqual([
      [1, "Ada L.", 100, false],
      [2, "Test L.", 50, true],
    ]);
    expect(JSON.stringify(view)).not.toContain("@");
  });

  it("ranks all-time XP from the cached totals, with no weekly reset", async () => {
    await prisma.user.update({ where: { id: fx.learner.id }, data: { leaderboardOptIn: true } });
    const top = await optedInLearner("Top Totals");
    const low = await optedInLearner("Low Totals");
    await award(top.user.id, top.enrollment.id, 1000, "top");
    await award(low.user.id, low.enrollment.id, 250, "low");
    await award(fx.learner.id, fx.enrollment.id, 100, "viewer");

    const view = (await hub("category=all_time_xp&scope=global")).body.data;
    expect(view.status).toBe("ready");
    expect(view).toMatchObject({ category: "all_time_xp", scope: "global", metricLabel: "XP", league: null, lastWeek: null, weekStart: null, resetsAt: null });
    const viewerTotal = (await prisma.user.findUniqueOrThrow({ where: { id: fx.learner.id } })).xpTotal;
    expect(view.you.score).toBe(viewerTotal);
    const rankOf = (name: string) => view.entries.find((entry: { name: string }) => entry.name === name)?.rank;
    expect(rankOf("Top T.")).toBe(1);
    expect(rankOf("Low T.")).toBeLessThan(rankOf("Test L."));
  });

  it("ranks speed by chapters completed this week, ties by lower average study time", async () => {
    await prisma.user.update({ where: { id: fx.learner.id }, data: { leaderboardOptIn: true } });
    const module = await prisma.module.create({ data: { courseId: fx.course.id, title: "Hub module", order: 99 } });
    const chapters = await prisma.chapter.createManyAndReturn({
      data: Array.from({ length: 3 }, (_, i) => ({
        courseId: fx.course.id,
        moduleId: module.id,
        slug: `hub-chapter-${fx.tag}-${i}`,
        title: `Hub chapter ${i}`,
        order: 100 + i,
        source: "# Hub",
        publishedAt: new Date(),
      })),
    });
    const complete = (enrollmentId: string, count: number, seconds: number) =>
      prisma.chapterProgress.createMany({
        data: Array.from({ length: count }, (_, i) => ({
          enrollmentId,
          chapterId: chapters[i]!.id,
          status: "COMPLETED",
          timeSpentSeconds: seconds,
          completedAt: new Date(),
        })),
      });

    const fast = await optedInLearner("Fast Finch");
    const tieQuick = await optedInLearner("Quick Quinn");
    const tieSlow = await optedInLearner("Slow Sidney");
    await complete(fast.enrollment.id, 3, 300);
    await complete(tieQuick.enrollment.id, 2, 300);
    await complete(tieSlow.enrollment.id, 2, 600);

    const view = (await hub("category=speed&scope=global")).body.data;
    expect(view).toMatchObject({ status: "ready", category: "speed", scope: "global", metricLabel: "chapters", weekStart: dateToDayKey(currentLeaderboardWeek()) });
    const rankOf = (name: string) => view.entries.find((entry: { name: string }) => entry.name === name)?.rank;
    const scoreOf = (name: string) => view.entries.find((entry: { name: string }) => entry.name === name)?.score;
    expect(scoreOf("Fast F.")).toBe(3);
    expect(rankOf("Quick Q.")).toBeLessThan(rankOf("Slow S.")); // same count, quicker average wins
    expect(rankOf("Fast F.")).toBe(1);
    expect(view.you).toMatchObject({ rank: view.groupSize, score: 0 });
  });

  it("ranks streaks from daily activity, counted in each learner's own timezone", async () => {
    await prisma.user.update({ where: { id: fx.learner.id }, data: { leaderboardOptIn: true } });
    const five = await optedInLearner("Five Day Finn");
    const three = await optedInLearner("Three Day Tia");
    const active = (enrollmentId: string, days: number) =>
      prisma.dailyActivity.createMany({
        data: Array.from({ length: days }, (_, i) => ({
          enrollmentId,
          date: dayKeyToDate(shiftDayKey(dateToDayKey(new Date()), -i)),
          activeSeconds: 600,
        })),
      });
    await active(five.enrollment.id, 5);
    await active(three.enrollment.id, 3);

    const view = (await hub("category=streak&scope=global")).body.data;
    expect(view).toMatchObject({ status: "ready", category: "streak", scope: "global", metricLabel: "day streak", weekStart: null, resetsAt: null });
    const scoreOf = (name: string) => view.entries.find((entry: { name: string }) => entry.name === name)?.score;
    expect(scoreOf("Five F.")).toBe(5);
    expect(scoreOf("Three T.")).toBe(3);
    expect(view.you.score).toBe(0);
  });

  it("serves the course board through the hub and rejects bad scope combinations", async () => {
    await prisma.user.update({ where: { id: fx.learner.id }, data: { leaderboardOptIn: true } });
    const ada = await optedInLearner("Ada Lovelace");
    await award(ada.user.id, ada.enrollment.id, 100, "ada");

    const view = (await hub(`category=weekly_xp&scope=course&courseId=${fx.course.id}`)).body.data;
    expect(view).toMatchObject({ status: "ready", category: "weekly_xp", scope: "course", courseId: fx.course.id, courseTitle: fx.course.title, league: null, metricLabel: "XP" });
    expect(view.entries.map((entry: { name: string }) => entry.name)).toContain("Ada L.");

    expect((await hub("category=weekly_xp&scope=course")).status).toBe(400);
    expect((await hub("category=speed&scope=course&courseId=whatever")).status).toBe(400);
    expect((await hub("category=nope&scope=global")).status).toBe(400);
  });

  it("is disabled when leaderboards are switched off", async () => {
    env.GAMIFICATION_LEADERBOARDS = false;
    const view = (await hub("category=weekly_xp&scope=global")).body.data;
    expect(view).toMatchObject({ status: "disabled", category: "weekly_xp", scope: "global" });
  });

  it("never names learners who hide game elements", async () => {
    await prisma.user.update({ where: { id: fx.learner.id }, data: { leaderboardOptIn: true } });
    const ghost = await optedInLearner("Ghostly Greta");
    await prisma.user.update({ where: { id: ghost.user.id }, data: { gamificationHidden: true } });
    await award(ghost.user.id, ghost.enrollment.id, 999, "ghost");
    await award(fx.learner.id, fx.enrollment.id, 10, "viewer");

    const view = (await hub("category=weekly_xp&scope=global")).body.data;
    expect(view.groupSize).toBe(1);
    expect(JSON.stringify(view)).not.toContain("Greta");
  });
});

describe("league reset", () => {
  it("promotes the top 10%, demotes the bottom 20%, holds the rest, and settles once", async () => {
    const weekKey = previousLeagueWeek(new Date("2027-01-12T12:00:00Z"));
    const at = dayKeyToDate(shiftDayKey(dateToDayKey(weekKey), 2)); // Wednesday of the closed week
    const gold: Awaited<ReturnType<typeof optedInLearner>>[] = [];
    for (let i = 0; i < 26; i += 1) gold.push(await optedInLearner(`Gold ${i}`, { leagueTier: "GOLD" }));
    const diamond = await optedInLearner("Diamond Dana", { leagueTier: "DIAMOND" });
    const bronze = await optedInLearner("Bronze Bo", { leagueTier: "BRONZE" });

    for (let i = 0; i < 26; i += 1) {
      await award(gold[i]!.user.id, gold[i]!.enrollment.id, (26 - i) * 10, `gold-${i}`, at);
    }
    await award(diamond.user.id, diamond.enrollment.id, 500, "diamond", at);
    await award(bronze.user.id, bronze.enrollment.id, 5, "bronze", at);

    await clearPlacementMarker(weekKey);
    const result = await resetLeaguesForWeek(weekKey);
    expect(result).toEqual({ weekKey: dateToDayKey(weekKey), promoted: 3, demoted: 6, held: 19 });

    const tierOf = async (userId: string) => (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).leagueTier;
    expect(await tierOf(gold[0]!.user.id)).toBe("PLATINUM");
    expect(await tierOf(gold[2]!.user.id)).toBe("PLATINUM"); // rank 3 of 26
    expect(await tierOf(gold[3]!.user.id)).toBe("GOLD"); // rank 4 remains held
    expect(await tierOf(gold[19]!.user.id)).toBe("GOLD"); // rank 20 remains held
    expect(await tierOf(gold[20]!.user.id)).toBe("SILVER"); // rank 21 starts the bottom 20% zone
    expect(await tierOf(gold[25]!.user.id)).toBe("SILVER"); // rank 26 of 26
    expect(await tierOf(diamond.user.id)).toBe("DIAMOND"); // nothing above Diamond
    expect(await tierOf(bronze.user.id)).toBe("BRONZE"); // nothing below Bronze

    const placements = await prisma.leaguePlacement.findMany({ where: { weekKey, userId: { in: [...gold.map((learner) => learner.user.id), diamond.user.id, bronze.user.id] } } });
    expect(placements).toHaveLength(28);
    expect(placements.find((row) => row.userId === gold[2]!.user.id)).toMatchObject({ tier: "GOLD", rank: 3, xp: 240, outcome: "PROMOTED" });
    expect(placements.find((row) => row.userId === gold[25]!.user.id)).toMatchObject({ rank: 26, outcome: "DEMOTED" });

    expect(await resetLeaguesForWeek(weekKey)).toEqual({ weekKey: dateToDayKey(weekKey), promoted: 0, demoted: 0, held: 0 });
    expect(await prisma.leaguePlacement.count({ where: { weekKey, userId: { in: [...gold.map((learner) => learner.user.id), diamond.user.id, bronze.user.id] } } })).toBe(28);
  });

  it("excludes learners who opted out before the reset", async () => {
    const weekKey = previousLeagueWeek(new Date("2027-02-09T12:00:00Z"));
    const at = dayKeyToDate(shiftDayKey(dateToDayKey(weekKey), 1));
    const stayed = await optedInLearner("Stayed Sam", { leagueTier: "GOLD" });
    const left = await optedInLearner("Left Lou", { leagueTier: "GOLD" });
    await award(stayed.user.id, stayed.enrollment.id, 100, "stayed", at);
    await award(left.user.id, left.enrollment.id, 100, "left", at);
    await prisma.user.update({ where: { id: left.user.id }, data: { leaderboardOptIn: false } });

    await clearPlacementMarker(weekKey);
    await resetLeaguesForWeek(weekKey);
    const placements = await prisma.leaguePlacement.findMany({ where: { weekKey, userId: stayed.user.id } });
    expect(placements.map((row) => row.userId)).toEqual([stayed.user.id]);
    expect(placements[0]).toMatchObject({ rank: 1, outcome: "HELD" }); // a league of one promotes nobody
  });

  it("promotes a learner who reaches the goal outside the competitive zone", async () => {
    const weekKey = previousLeagueWeek(new Date("2027-03-09T12:00:00Z"));
    const at = dayKeyToDate(shiftDayKey(dateToDayKey(weekKey), 2));
    const gold: Awaited<ReturnType<typeof optedInLearner>>[] = [];
    for (let i = 0; i < 20; i += 1) gold.push(await optedInLearner(`Target Top ${i}`, { leagueTier: "GOLD" }));
    const target = await optedInLearner("Target Winner", { leagueTier: "GOLD" });
    for (const learner of gold) await award(learner.user.id, learner.enrollment.id, 500, `target-top-${learner.user.id}`, at);
    await award(target.user.id, target.enrollment.id, 400, "target-winner", at);

    await clearPlacementMarker(weekKey);
    const result = await resetLeaguesForWeek(weekKey);
    expect(result.promoted).toBe(21);
    const placement = await prisma.leaguePlacement.findUniqueOrThrow({ where: { userId_weekKey: { userId: target.user.id, weekKey } } });
    expect(placement).toMatchObject({ rank: 21, xp: 400, outcome: "PROMOTED_TARGET" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).toMatchObject({ leagueTier: "PLATINUM" });
  });

  it("uses the recovery quest before a League Shield for one demotion", async () => {
    const weekKey = previousLeagueWeek(new Date("2027-04-13T12:00:00Z"));
    const at = dayKeyToDate(shiftDayKey(dateToDayKey(weekKey), 2));
    const silver: Awaited<ReturnType<typeof optedInLearner>>[] = [];
    for (let i = 0; i < 10; i += 1) silver.push(await optedInLearner(`Recovery Silver ${i}`, { leagueTier: "SILVER" }));
    const protectedLearner = silver[9]!;
    for (let i = 0; i < 9; i += 1) await award(silver[i]!.user.id, silver[i]!.enrollment.id, 100 + (9 - i) * 10, `recovery-${i}`, at);
    await award(protectedLearner.user.id, protectedLearner.enrollment.id, 50, "recovery-protected", at);
    await prisma.chapterProgress.create({
      data: {
        enrollmentId: protectedLearner.enrollment.id,
        chapterId: fx.chapterA.id,
        status: "COMPLETED",
        startedAt: at,
        completedAt: new Date(at.getTime() + 60_000),
      },
    });

    await clearPlacementMarker(weekKey);
    await resetLeaguesForWeek(weekKey);
    const placement = await prisma.leaguePlacement.findUniqueOrThrow({ where: { userId_weekKey: { userId: protectedLearner.user.id, weekKey } } });
    expect(placement).toMatchObject({ rank: 10, outcome: "RECOVERY_HELD" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: protectedLearner.user.id } })).toMatchObject({ leagueTier: "SILVER" });
  });
});
