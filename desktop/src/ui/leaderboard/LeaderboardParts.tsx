import type { ReactNode } from 'react';
import {
  LEAGUE_TIER_LABELS,
  LEAGUE_TIER_ORDER,
  LEAGUE_WEEKLY_GOALS,
  formatNumber,
  formatScore,
  initials,
  LEAGUE_PROMOTION_PERCENT,
  nextLeagueTier,
  prevLeagueTier,
  resetLabel,
  type LeaderboardHubEntry,
  type LeagueInfo,
} from '../../domain/leaderboard';

const MEDAL: Record<number, string> = {
  1: 'bg-brand-yellow text-foreground',
  2: 'bg-muted text-foreground',
  3: 'bg-brand-yellow/40 text-foreground',
};

const PILL = {
  outline: 'border border-border text-foreground',
  muted: 'border border-border text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive',
} as const;

export function Pill({ tone, children }: { tone: keyof typeof PILL; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tone]}`}>{children}</span>;
}

const BADGE_COLORS: Record<LeagueTier, string> = {
  BRONZE: '#c87945',
  SILVER: '#b7c4d2',
  GOLD: '#f0b936',
  PLATINUM: '#91a8b8',
  COBALT: '#3276c8',
  JADE: '#35a77d',
  QUARTZ: '#a78bda',
  AURORA: '#5fb7bd',
  ZENITH: '#665ed0',
  DIAMOND: '#55aee8',
};

export function LeagueBadge({ tier }: { tier: LeagueTier }) {
  const colors = BADGE_COLORS[tier];
  return (
    <svg aria-label={`${LEAGUE_TIER_LABELS[tier]} League`} role="img" viewBox="0 0 48 48" className="size-7" fill="none">
      <title>{LEAGUE_TIER_LABELS[tier]} League</title>
      <circle cx="24" cy="24" r="19" fill={colors} stroke="#ffffff" strokeWidth="1.5" />
      {tier === 'BRONZE' ? <path d="M24 10 35 15v9c0 7-4.4 11.5-11 15-6.6-3.5-11-8-11-15v-9l11-5Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === 'SILVER' ? <path d="M12 27c0-8 5-13 12-13s12 5 12 13c0 5-4 9-12 9s-12-4-12-9Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === 'GOLD' ? <path d="m24 8 3.5 8 8.5.8-6.4 5.6 1.9 8.3-7.5-4.4-7.5 4.4 1.9-8.3-6.4-5.6 8.5-.8L24 8Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === 'PLATINUM' ? <path d="m13 14 11-6 11 6v13l-11 6-11-6V14Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === 'COBALT' ? <path d="M24 8v32M8 24h32M13 13l22 22M35 13 13 35" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" /> : null}
      {tier === 'JADE' ? <path d="M34 10c-12 1-20 7-20 17 0 6 5 10 10 7 7-4 10-12 10-24Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === 'QUARTZ' ? <path d="m24 7 10 9-4 19H18l-4-19 10-9Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === 'AURORA' ? <path d="M9 29c5-10 10-10 15 0s10 10 15 0M9 21c5-10 10-10 15 0s10 10 15 0" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" /> : null}
      {tier === 'ZENITH' ? <path d="m24 7 4 12 13 5-13 5-4 12-4-12-13-5 13-5 4-12Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tier === 'DIAMOND' ? <path d="m24 7 12 11-12 23-12-23L24 7Z" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

export function Rank({ rank, highlight }: { rank: number; highlight?: boolean }) {
  const tone = MEDAL[rank] ?? (highlight ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground');
  return (
    <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${tone}`}>
      {rank}
    </span>
  );
}

export function ProgressTrack({ score, best, label }: { score: number; best: number; label: string }) {
  const percent = Math.min(100, Math.round((score / best) * 100));
  return (
    <div
      className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(score, best)}
      aria-valuemin={0}
      aria-valuemax={best}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function BestScore({ score, best, metricLabel, label }: { score: number; best: number; metricLabel: string; label: string }) {
  const beaten = score > best;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={beaten ? 'font-medium text-primary' : 'font-medium text-foreground'}>
          {beaten ? 'New personal best!' : label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {formatNumber(score)} / {formatNumber(best)} {metricLabel}
        </span>
      </div>
      <ProgressTrack score={score} best={best} label={label} />
    </div>
  );
}

export function StandingCard({
  context,
  rank,
  groupSize,
  score,
  bestScore,
  metricLabel,
  bestLabel,
  resetsAt,
}: {
  context: string;
  rank: number;
  groupSize: number;
  score: number;
  bestScore: number | null;
  metricLabel: string;
  bestLabel: string;
  resetsAt: string | null;
}) {
  const best = bestScore ?? 0;
  return (
    <section aria-labelledby="standing-heading" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-5 py-4 sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">Your place{context ? ` in ${context}` : ''}</p>
        <h2 id="standing-heading" className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-5xl font-bold tabular-nums tracking-tight text-foreground">#{rank}</span>
          <span className="text-base text-muted-foreground">of {formatNumber(groupSize)} learners</span>
        </h2>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{metricLabel}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums">{formatScore(score, metricLabel)}</p>
          </div>
          {resetsAt ? <p className="text-sm tabular-nums text-muted-foreground">{resetLabel(resetsAt)}</p> : null}
        </div>
        {best > 0 ? (
          <BestScore score={score} best={best} metricLabel={metricLabel} label={bestLabel} />
        ) : (
          <p className="text-sm text-muted-foreground">Your first week on this board. Every chapter counts.</p>
        )}
      </div>
    </section>
  );
}

function LeagueOutcome({ league }: { league: LeagueInfo }) {
  const last = league.lastWeek;
  if (!last) return null;
  const box = 'rounded-xl border px-4 py-2.5 text-sm font-medium';
  if (last.outcome === 'PROMOTED' || last.outcome === 'PROMOTED_TARGET' || last.outcome === 'PROMOTED_BOTH') {
    const to = nextLeagueTier(last.fromTier);
    const path = last.outcome === 'PROMOTED_TARGET' ? 'by reaching your weekly goal' : last.outcome === 'PROMOTED_BOTH' ? 'by rank and your weekly goal' : 'by rank';
    return (
      <p className={`${box} border-primary/30 bg-primary/10 text-primary`}>
        Promoted to {to ? LEAGUE_TIER_LABELS[to] : 'a higher league'} last week {path}.
      </p>
    );
  }
  if (last.outcome === 'RECOVERY_HELD' || last.outcome === 'SHIELD_HELD') {
    const protection = last.outcome === 'RECOVERY_HELD' ? 'recovery quest' : 'League Shield';
    return <p className={`${box} border-primary/30 bg-primary/10 text-primary`}>Your {protection} protected your league place last week.</p>;
  }
  if (last.outcome === 'DEMOTED') {
    const to = prevLeagueTier(last.fromTier);
    return (
      <p className={`${box} border-destructive/30 bg-destructive/10 text-destructive`}>
        Demoted to {to ? LEAGUE_TIER_LABELS[to] : 'a lower league'} last week.
      </p>
    );
  }
  return (
    <p className={`${box} border-border bg-muted/40 text-muted-foreground`}>
      You held {LEAGUE_TIER_LABELS[league.tier]} League last week.
    </p>
  );
}

export function LeagueCard({
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
  const next = nextLeagueTier(league.tier);
  const prev = prevLeagueTier(league.tier);
  const isPromoting = promoteCount > 0 && league.rank <= promoteCount && Boolean(next);
  const demoteCount = league.demotionZone <= league.groupSize ? Math.max(0, league.groupSize - league.demotionZone + 1) : 0;
  const isDemoting = demoteCount > 0 && league.rank >= league.demotionZone && Boolean(prev);
  const best = bestScore ?? 0;
  const label = 'This week compared with your best week';
  const currentIndex = LEAGUE_TIER_ORDER.indexOf(league.tier);

  const journey = (
    <section aria-labelledby="league-journey-heading" className="border-b border-border bg-muted/20 px-5 py-5 sm:px-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">League journey</p>
          <h3 id="league-journey-heading" className="mt-1 text-lg font-semibold">Your weekly path</h3>
        </div>
        <span className="text-xs text-muted-foreground">{currentIndex + 1} of {LEAGUE_TIER_ORDER.length}</span>
      </div>
      <ol aria-label="League progression" className="mt-5 flex min-w-[680px] items-start">
        {LEAGUE_TIER_ORDER.map((tier, index) => {
          const current = tier === league.tier;
          const nextTier = tier === next;
          const past = currentIndex > index;
          return (
            <li key={tier} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${index > 0 && past ? 'bg-primary' : 'bg-border'}`} />
                <span className={`grid size-9 shrink-0 place-items-center rounded-full border text-[10px] font-bold uppercase ${current ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15' : nextTier ? 'border-primary/60 bg-primary/10 text-primary ring-2 ring-primary/10' : past ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}>
                  <LeagueBadge tier={tier} />
                </span>
                <span className={`h-0.5 flex-1 ${past ? 'bg-primary' : 'bg-border'}`} />
              </div>
              <span className={`mt-2 text-center text-[11px] leading-tight ${current || nextTier ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{LEAGUE_TIER_LABELS[tier]}</span>
              <span className="mt-1 text-[10px] text-muted-foreground">{current ? 'You are here' : nextTier ? 'Next' : past ? 'Complete' : 'Upcoming'}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Current league</p>
          <p className="mt-1 text-sm font-semibold">{LEAGUE_TIER_LABELS[league.tier]} · {formatNumber(league.goal)} XP goal</p>
          <p className="mt-1 text-xs text-muted-foreground">Reach the goal or finish in the top {Math.round(LEAGUE_PROMOTION_PERCENT * 100)}%.</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next league</p>
          <p className="mt-1 text-sm font-semibold">{next ? `${LEAGUE_TIER_LABELS[next]} · ${formatNumber(LEAGUE_WEEKLY_GOALS[next])} XP goal` : 'Diamond · final league'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{next ? `You are one tier away from ${LEAGUE_TIER_LABELS[next]}.` : 'You have reached the top of the league journey.'}</p>
        </div>
      </div>
    </section>
  );

  return (
    <section aria-labelledby="league-heading" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="outline">{LEAGUE_TIER_LABELS[league.tier]} League</Pill>
            {isPromoting ? (
              <Pill tone="primary">Promotion zone</Pill>
            ) : isDemoting ? (
              <Pill tone="destructive">Demotion zone</Pill>
            ) : (
              <Pill tone="muted">Safe zone</Pill>
            )}
          </div>
          {resetsAt ? <span className="text-sm tabular-nums text-muted-foreground">{resetLabel(resetsAt)}</span> : null}
        </div>
        <div className="mt-3">
          <p className="text-sm font-medium text-muted-foreground">Your place in {LEAGUE_TIER_LABELS[league.tier]}</p>
          <h2 id="league-heading" className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-5xl font-bold tabular-nums tracking-tight text-foreground">#{league.rank}</span>
            <span className="text-base text-muted-foreground">of {formatNumber(league.groupSize)} learners</span>
          </h2>
        </div>
      </div>

      {journey}

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{metricLabel === 'XP' ? 'XP this week' : metricLabel}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums">{formatScore(score, metricLabel)}</p>
          </div>
          {next && promoteCount > 0 ? (
            <p className="text-sm font-medium text-primary">
              Top {Math.round(LEAGUE_PROMOTION_PERCENT * 100)}% ({promoteCount} {promoteCount === 1 ? 'spot' : 'spots'}) or the weekly goal promotes to {LEAGUE_TIER_LABELS[next]}
            </p>
          ) : next && league.goal > 0 ? (
            <p className="text-sm font-medium text-primary">Reach the weekly goal to promote</p>
          ) : prev && demoteCount > 0 ? (
            <p className="text-sm font-medium text-destructive">
              Bottom {demoteCount} demote to {LEAGUE_TIER_LABELS[prev]}
            </p>
          ) : league.tier === 'DIAMOND' ? (
            <p className="text-sm text-muted-foreground">Top league. No higher tier to promote to.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Base league. Protected from demotion.</p>
          )}
        </div>

        {league.goal > 0 ? (
          <div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={league.goalMet ? 'font-semibold text-primary' : 'font-medium text-foreground'}>
                {league.goalMet ? 'Weekly goal met' : 'Achievement promotion'}
              </span>
              <span className="tabular-nums text-muted-foreground">{formatNumber(score)} / {formatNumber(league.goal)} XP</span>
            </div>
            <ProgressTrack score={score} best={league.goal} label="Weekly league goal progress" />
            <p className="mt-2 text-xs text-muted-foreground">Reach your goal or finish in the top {Math.round(LEAGUE_PROMOTION_PERCENT * 100)}%. Both paths unlock the next league.</p>
          </div>
        ) : null}

        {league.recovery ? (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Recovery quest</span>
              <span className={league.recovery.completed ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                {league.recovery.completed ? 'Complete' : 'In progress'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Complete {league.recovery.chapterTarget} chapter and earn {formatNumber(league.recovery.xpTarget)} XP to protect against one demotion.</p>
          </div>
        ) : null}

        {best > 0 ? (
          <div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={score > best ? 'font-semibold text-primary' : 'font-medium text-foreground'}>
                {score > best ? 'New personal best!' : 'Beat your best week'}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(score)} / {formatNumber(best)} XP
              </span>
            </div>
            <ProgressTrack score={score} best={best} label={label} />
          </div>
        ) : null}

        <LeagueOutcome league={league} />
      </div>
    </section>
  );
}

export function StandingsList({
  entries,
  metricLabel,
  league,
}: {
  entries: LeaderboardHubEntry[];
  metricLabel: string;
  league: LeagueInfo | null;
}) {
  if (entries.length === 0) return null;

  const zoneFor = (rank: number): 'promote' | 'demote' | null => {
    if (!league) return null;
    if (nextLeagueTier(league.tier) && league.promotionZone > 0 && rank <= league.promotionZone) return 'promote';
    if (prevLeagueTier(league.tier) && league.demotionZone <= league.groupSize && rank >= league.demotionZone) return 'demote';
    return null;
  };

  return (
    <section aria-labelledby="standings-heading" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 id="standings-heading" className="text-lg font-semibold tracking-tight">
        Standings
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {league ? `Learners nearest your rank in ${LEAGUE_TIER_LABELS[league.tier]} League.` : 'Learners nearest your rank.'}
      </p>

      <ol className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {entries.map((entry) => {
          const zone = zoneFor(entry.rank);
          const tone = entry.isYou
            ? 'bg-primary/5'
            : zone === 'promote'
              ? 'bg-primary/[0.04]'
              : zone === 'demote'
                ? 'bg-destructive/[0.04]'
                : '';
          return (
            <li
              key={`${entry.rank}-${entry.name}`}
              aria-current={entry.isYou ? 'true' : undefined}
              className={`flex items-center gap-3 px-3.5 py-3.5 sm:px-4 ${tone}`}
            >
              <Rank rank={entry.rank} highlight={entry.isYou} />
              <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${entry.isYou ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                {initials(entry.name)}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className={`truncate text-base text-foreground ${entry.isYou ? 'font-semibold' : 'font-medium'}`}>
                  {entry.name || 'You'}
                </span>
                {entry.isYou ? <Pill tone="muted">You</Pill> : null}
                {zone === 'promote' ? <Pill tone="primary">Promote</Pill> : zone === 'demote' ? <Pill tone="destructive">Demote</Pill> : null}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                {formatScore(entry.score, metricLabel)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function LastWeekWinners({ winners, metricLabel }: { winners: LeaderboardHubEntry[]; metricLabel: string }) {
  return (
    <section aria-labelledby="last-week-heading" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 id="last-week-heading" className="text-lg font-semibold tracking-tight">
        Last week&apos;s winners
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Top three from the board that just closed.</p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {winners.map((winner) => (
          <li
            key={winner.rank}
            className={`flex flex-col items-center rounded-xl border px-3 py-5 text-center ${
              winner.isYou ? 'border-brand-yellow bg-brand-yellow/15' : 'border-border bg-muted/30'
            }`}
          >
            <Rank rank={winner.rank} />
            <span className={`mt-3 w-full truncate text-sm ${winner.isYou ? 'font-semibold' : 'font-medium'}`}>
              {winner.isYou ? (winner.name ? `${winner.name} (You)` : 'You') : winner.name}
            </span>
            <span className="mt-1 text-sm tabular-nums text-muted-foreground">{formatScore(winner.score, metricLabel)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
