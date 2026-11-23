import { describe, expect, it } from "vitest";
import {
  buildStreakWeek,
  shouldShowStreakPopup,
  streakDaySummary,
} from "@/shared/lib/streak-popup";
import { computeStreak } from "@/shared/lib/streak";

describe("shouldShowStreakPopup (once per local day)", () => {
  const today = "2026-11-03";

  it("does not show again after dismiss in the same window", () => {
    expect(shouldShowStreakPopup({ seenOn: today, today })).toBe(false);
  });

  it("shows on the next local day after a dismiss", () => {
    expect(shouldShowStreakPopup({ seenOn: "2026-11-02", today })).toBe(true);
  });

  it("shows on the first open for everyone, including a learner with no streak", () => {
    expect(shouldShowStreakPopup({ seenOn: null, today })).toBe(true);
  });
});

describe("streak week + calculation", () => {
  it("builds the last seven days with missed, completed, and today states", () => {
    const today = "2026-11-03";
    const week = buildStreakWeek({
      today,
      activeDays: ["2026-11-02", "2026-11-03"],
      secondsByDay: { "2026-11-02": 300, "2026-11-03": 90 },
    });
    expect(week).toHaveLength(7);
    expect(week.at(-1)).toMatchObject({ day: today, status: "today", seconds: 90 });
    expect(week[5]).toMatchObject({ status: "completed" });
    expect(week[0]?.status).toBe("missed");
    expect(streakDaySummary(week[5]!, today)).toContain("5 minutes");
  });

  it("counts consecutive learning days with computeStreak", () => {
    const today = "2026-11-03";
    const active = ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"];
    expect(computeStreak(active, today).count).toBe(4);
  });
});
