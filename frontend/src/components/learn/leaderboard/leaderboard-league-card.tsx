import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  LEAGUE_PROMOTION_PERCENT,
  LEAGUE_TIER_LABELS,
  LEAGUE_TIER_ORDER,
  nextLeagueTier,
  prevLeagueTier,
  leagueWeeklyGoal,
} from "@/shared/gamification/leagues";
import type { LeagueInfo } from "@/shared/api/gamification";
import { formatNumber, formatScore, resetLabel } from "./leaderboard-format";
import { LeagueBadge } from "./league-badge";

function LeagueOutcomeBanner({ league }: { league: LeagueInfo }) {
  const lastWeek = league.lastWeek;
  if (!lastWeek) return null;

  if (lastWeek.outcome === "PROMOTED" || lastWeek.outcome === "PROMOTED_TARGET" || lastWeek.outcome === "PROMOTED_BOTH") {
    const to = nextLeagueTier(lastWeek.fromTier);
    const path = lastWeek.outcome === "PROMOTED_TARGET" ? "by reaching your weekly goal" : lastWeek.outcome === "PROMOTED_BOTH" ? "by rank and your weekly goal" : "by rank";
    return (
      <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-2.5 text-sm font-medium text-ok">
        Promoted to {to ? LEAGUE_TIER_LABELS[to] : "a higher league"} last week {path}.
      </p>
    );
  }

  if (lastWeek.outcome === "DEMOTED") {
    const to = prevLeagueTier(lastWeek.fromTier);
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
        Demoted to {to ? LEAGUE_TIER_LABELS[to] : "a lower league"} last week.
      </p>
    );
  }

  if (lastWeek.outcome === "RECOVERY_HELD") {
    return (
      <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-2.5 text-sm font-medium text-ok">
        Your recovery quest protected your {LEAGUE_TIER_LABELS[league.tier]} League place last week.
      </p>
    );
  }

  if (lastWeek.outcome === "SHIELD_HELD") {
    return (
      <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-2.5 text-sm font-medium text-ok">
        Your League Shield protected your {LEAGUE_TIER_LABELS[league.tier]} League place last week.
      </p>
    );
  }

  return (
    <p className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
      You held {LEAGUE_TIER_LABELS[league.tier]} League last week.
    </p>
  );
}

function LeagueProgression({ league }: { league: LeagueInfo }) {
  const currentIndex = LEAGUE_TIER_ORDER.indexOf(league.tier);
  const next = nextLeagueTier(league.tier);
  const currentRef = useRef<HTMLLIElement | null>(null);

  // The tier rail is wider than a phone; bring the learner's tier into view.
  useEffect(() => {
    try {
      currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    } catch {
      // Best effort only.
    }
  }, [league.tier]);

  return (
    <section aria-labelledby="league-journey-heading" className="border-b border-border bg-muted/20 px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">League journey</p>
          <h3 id="league-journey-heading" className="mt-1 text-lg font-semibold tracking-[-0.02em]">
            Your weekly path
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">{currentIndex + 1} of {LEAGUE_TIER_ORDER.length}</span>
      </div>

      <ol aria-label="League progression" className="mt-5 flex min-w-[680px] items-start">
        {LEAGUE_TIER_ORDER.map((tier, index) => {
          const isCurrent = tier === league.tier;
          const isNext = tier === next;
          const isPast = currentIndex > index;
          const isLast = index === LEAGUE_TIER_ORDER.length - 1;
          return (
            <li key={tier} ref={isCurrent ? currentRef : undefined} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {index > 0 ? <span aria-hidden className={`h-0.5 flex-1 ${isPast || isCurrent ? "bg-primary" : "bg-border"}`} /> : <span aria-hidden className="flex-1" />}
                <span
                  title={LEAGUE_TIER_LABELS[tier]}
                  className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : isNext
                        ? "border-primary/60 bg-primary/10 text-primary ring-2 ring-primary/10"
                        : isPast
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <LeagueBadge tier={tier} size="sm" />
                </span>
                {!isLast ? <span aria-hidden className={`h-0.5 flex-1 ${isPast ? "bg-primary" : "bg-border"}`} /> : <span aria-hidden className="flex-1" />}
              </div>
              <span className={`mt-2 text-center text-[11px] leading-tight ${isCurrent || isNext ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {LEAGUE_TIER_LABELS[tier]}
              </span>
              <span className="mt-1 text-[10px] text-muted-foreground">
                {isCurrent ? "You are here" : isNext ? "Next" : isPast ? "Complete" : "Upcoming"}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Current league</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{LEAGUE_TIER_LABELS[league.tier]} · {formatNumber(league.goal)} XP goal</p>
          {next ? (
            <p className="mt-1 text-xs text-muted-foreground">Reach this goal or finish in the top {Math.round(LEAGUE_PROMOTION_PERCENT * 100)}% to move up.</p>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next league</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {next ? `${LEAGUE_TIER_LABELS[next]} · ${formatNumber(leagueWeeklyGoal(next))} XP goal` : `${LEAGUE_TIER_LABELS[league.tier]} · final league`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {next ? `You are one tier away from ${LEAGUE_TIER_LABELS[next]}.` : "You have reached the top of the league journey."}
          </p>
        </div>
      </div>
    </section>
  );
}

export function LeaderboardLeagueCard({
  league,
  score,
  metricLabel,
  bestScore,
  resetsAt,
}: {
  league: LeagueInfo;
  score: number;
  metricLabel: string;
  bestScore: number | null;
  resetsAt: string | null;
}) {
  const promoteCount = league.promotionZone;
  const canPromote = Boolean(nextLeagueTier(league.tier));
  const isPromoting = canPromote && (league.inPromotionZone || league.goalMet);

  const demoteCount =
    league.demotionZone <= league.groupSize ? Math.max(0, league.groupSize - league.demotionZone + 1) : 0;
  const isDemoting = demoteCount > 0 && league.rank >= league.demotionZone && Boolean(prevLeagueTier(league.tier));

  const beaten = bestScore !== null && bestScore > 0 && score > bestScore;
  const bestPct = bestScore !== null && bestScore > 0 ? Math.min(100, Math.round((score / bestScore) * 100)) : 0;

  return (
    <section aria-labelledby="league-heading" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold">
              {LEAGUE_TIER_LABELS[league.tier]} League
            </Badge>
            {league.goalMet && canPromote ? (
              <Badge variant="secondary" className="border-ok/30 bg-ok/10 text-ok font-semibold">
                Target met
              </Badge>
            ) : isPromoting ? (
              <Badge variant="secondary" className="border-ok/30 bg-ok/10 text-ok font-semibold">
                Promotion zone
              </Badge>
            ) : isDemoting ? (
              <Badge variant="destructive">Demotion zone</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground font-normal">
                Safe zone
              </Badge>
            )}
          </div>
          {resetsAt ? (
            <span className="text-sm tabular-nums text-muted-foreground" suppressHydrationWarning>
              {resetLabel(resetsAt)}
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          <p className="text-sm font-medium text-muted-foreground">Your place in {LEAGUE_TIER_LABELS[league.tier]}</p>
          <h2 id="league-heading" className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-4xl font-bold tabular-nums tracking-[-0.04em] text-foreground sm:text-5xl">
              #{league.rank}
            </span>
            <span className="text-base text-muted-foreground">of {formatNumber(league.groupSize)} learners</span>
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <LeagueProgression league={league} />
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{metricLabel === "XP" ? "XP this week" : metricLabel}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-[-0.02em]">{formatScore(score, metricLabel)}</p>
          </div>
          {nextLeagueTier(league.tier) && promoteCount > 0 ? (
            <p className="text-sm font-medium text-ok">
              Top {Math.round(LEAGUE_PROMOTION_PERCENT * 100)}% ({promoteCount} {promoteCount === 1 ? "spot" : "spots"}) or the weekly goal promotes to {LEAGUE_TIER_LABELS[nextLeagueTier(league.tier)!]}
            </p>
          ) : nextLeagueTier(league.tier) && league.goal > 0 ? (
            <p className="text-sm font-medium text-ok">Reach the weekly goal to promote</p>
          ) : prevLeagueTier(league.tier) && demoteCount > 0 ? (
            <p className="text-sm font-medium text-destructive">
              Bottom {demoteCount} demote to {LEAGUE_TIER_LABELS[prevLeagueTier(league.tier)!]}
            </p>
          ) : league.tier === LEAGUE_TIER_ORDER[LEAGUE_TIER_ORDER.length - 1] ? (
            <p className="text-sm text-muted-foreground">Top league — no higher tier to promote to</p>
          ) : (
            <p className="text-sm text-muted-foreground">Base league — protected from demotion</p>
          )}
        </div>

        {league.goal > 0 && canPromote ? (
          <div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={league.goalMet ? "font-semibold text-ok" : "font-medium text-foreground"}>
                {league.goalMet ? "Weekly goal met" : "Achievement promotion"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(score)} / {formatNumber(league.goal)} XP
              </span>
            </div>
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Weekly league goal progress"
              aria-valuenow={Math.min(score, league.goal)}
              aria-valuemin={0}
              aria-valuemax={league.goal}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.round((score / league.goal) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Reach your goal or finish in the top {Math.round(LEAGUE_PROMOTION_PERCENT * 100)}%. Both paths unlock the next league.
            </p>
          </div>
        ) : null}

        {league.recovery ? (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">Recovery quest</span>
              <span className={league.recovery.completed ? "font-semibold text-ok" : "text-muted-foreground"}>
                {league.recovery.completed ? "Complete" : "In progress"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Complete {league.recovery.chapterTarget} chapter and earn {formatNumber(league.recovery.xpTarget)} XP to protect against one demotion.
            </p>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              {league.recovery.chapters} / {league.recovery.chapterTarget} chapter · {formatNumber(league.recovery.xp)} / {formatNumber(league.recovery.xpTarget)} XP
            </p>
          </div>
        ) : null}

        {bestScore !== null && bestScore > 0 ? (
          <div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={beaten ? "font-semibold text-primary" : "font-medium text-foreground"}>
                {beaten ? "New personal best!" : "Beat your best week"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(score)} / {formatNumber(bestScore)} XP
              </span>
            </div>
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="This week compared with your best week"
              aria-valuenow={Math.min(score, bestScore)}
              aria-valuemin={0}
              aria-valuemax={bestScore}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${bestPct}%` }}
              />
            </div>
          </div>
        ) : null}

        <LeagueOutcomeBanner league={league} />
      </div>
    </section>
  );
}
