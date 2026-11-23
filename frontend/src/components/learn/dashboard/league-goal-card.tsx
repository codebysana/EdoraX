import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAGUE_PROMOTION_PERCENT, LEAGUE_TIER_LABELS, nextLeagueTier } from "@/shared/gamification/leagues";
import type { LeaderboardHubView } from "@/shared/api/gamification";

const numberFormat = new Intl.NumberFormat();

export function LeagueGoalCard({ view }: { view: LeaderboardHubView | null }) {
  if (!view || view.status === "disabled" || view.status === "unavailable") return null;

  if (view.status === "opt_in_required") {
    return (
      <Link
        href="/leaderboard"
        className={cn(
          "group flex items-start gap-3 rounded-2xl border bg-card p-5 outline-none transition-colors",
          "hover:border-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Trophy className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Weekly league</span>
          <span className="mt-1 block text-base font-semibold tracking-[-0.02em] text-foreground">Choose your path up</span>
          <span className="mt-1 block text-sm text-muted-foreground">Join the league to compete by rank or reach a weekly XP goal.</span>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Join leaderboard
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </span>
      </Link>
    );
  }

  if (!view.league) return null;

  const { league } = view;
  const next = nextLeagueTier(league.tier);
  const score = view.you.score;
  const goalPercent = league.goal > 0 ? Math.min(100, Math.round((score / league.goal) * 100)) : 0;
  const promotionPercent = Math.round(LEAGUE_PROMOTION_PERCENT * 100);
  const status = next === null ? "Top league" : league.goalMet ? "Target met" : league.inPromotionZone ? `Top ${promotionPercent}% promotion zone` : "Keep learning";

  return (
    <section aria-labelledby="league-goal-heading" className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Trophy className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="league-goal-heading" className="text-sm font-semibold">{LEAGUE_TIER_LABELS[league.tier]} League</h2>
            <span className="text-xs font-medium text-muted-foreground">{status}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {next ? `Reach your goal or finish in the top ${promotionPercent}% to reach ${LEAGUE_TIER_LABELS[next]}.` : "You are at the highest league."}
          </p>
          {league.goal > 0 ? (
            <>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">Weekly XP goal</span>
                <span className="tabular-nums text-muted-foreground">{numberFormat.format(score)} / {numberFormat.format(league.goal)} XP</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Weekly league goal progress" aria-valuenow={Math.min(score, league.goal)} aria-valuemin={0} aria-valuemax={league.goal}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${goalPercent}%` }} />
              </div>
            </>
          ) : null}
          <Link href="/leaderboard" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View league
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
