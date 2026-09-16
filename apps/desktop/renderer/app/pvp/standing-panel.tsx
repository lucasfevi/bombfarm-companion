'use client';

import type { ReactNode } from 'react';
import type { AppLocale, PvpDuelRow, PvpHistoryResult, PvpStanding } from '@bombfarm/contracts';
import { Bar, cn, FactTile, Panel, PanelHeader, Sparkline } from '@bombfarm/ui';
import { sub, subNodes, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCapturedAt, formatCount } from '../../lib/format';
import { duelsLeft, tierNumberOf } from '../../lib/pvp/pvp-rows';
import {
  pointsPerWin,
  pointsSeries,
  resultMarks,
  streak,
  tierAfter,
  tierMeterPercent,
  trendWindow,
  winRate,
  winsToNextTier,
} from '../../lib/pvp/pvp-trend';
import { usePvpRefresh } from '../../lib/pvp/use-pvp-refresh';
import { AccountRefreshControl } from '../account-refresh-control';

const MIN_TREND_ROWS = 2;

export function StandingPanel({ history }: { history: PvpHistoryResult | null }) {
  const t = useCopy();
  const { locale } = useLocale();
  const standing = history?.standing ?? null;
  const rank = history?.rank ?? null;
  const quota = history === null ? null : duelsLeft(history);
  const unread = t.pvpStandingUnknown;
  const refresh = usePvpRefresh();

  return (
    <Panel data-testid="pvp-standing" data-state={standing === null ? 'empty' : 'read'}>
      <PanelHeader title={t.pvpStandingTitle}>
        <span data-testid="pvp-standing-age">
          <AccountRefreshControl
            capturedAt={standing?.capturedAt ?? null}
            stale={false}
            busy={false}
            readState={refresh.state}
            onRefresh={refresh.request}
            ageLine={(age) => sub(t.pvpStandingAge, { age })}
          />
        </span>
      </PanelHeader>
      {standing === null && quota === null && rank === null ? (
        <p className="m-0 text-xs text-muted">{t.pvpStandingEmpty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-7 gap-y-4 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <StandingFigure
                label={t.pvpStandingTier}
                testId="pvp-standing-tier"
                value={standing === null ? null : tierNumberOf(standing.tier, standing.tierNumber)}
                unread={unread}
                {...(standing?.nextTierAt == null
                  ? {}
                  : { note: sub(t.pvpStandingTierNote, { next: formatCount(standing.nextTierAt, locale) }) })}
              />
              <StandingFigure
                label={t.pvpStandingPoints}
                testId="pvp-standing-points"
                value={
                  standing === null
                    ? null
                    : standing.nextTierAt === null
                      ? formatCount(standing.points, locale)
                      : sub(t.pvpStandingPointsValue, {
                          points: formatCount(standing.points, locale),
                          next: formatCount(standing.nextTierAt, locale),
                        })
                }
                unread={unread}
              />
              <StandingFigure
                label={t.pvpStandingDuels}
                testId="pvp-standing-duels"
                value={quota === null ? null : sub(t.pvpStandingDuelsValue, { left: quota.left, max: quota.max })}
                unread={unread}
              />
              <StandingFigure
                label={t.pvpStandingSlots}
                testId="pvp-standing-slots"
                value={
                  standing === null || standing.slots === null
                    ? null
                    : sub(t.pvpStandingSlotsValue, { slots: standing.slots, max: standing.slotsMax ?? standing.slots })
                }
                unread={unread}
              />
              <StandingFigure
                label={t.pvpStandingRank}
                testId="pvp-standing-rank"
                value={rank === null ? null : sub(t.pvpStandingRankValue, { position: formatCount(rank.position, locale) })}
                unread={t.pvpStandingRankUnknown}
                {...(rank === null
                  ? {}
                  : { note: sub(t.pvpStandingRankNote, { age: formatCapturedAt(rank.capturedAt, t), points: formatCount(rank.points, locale) }) })}
              />
            </div>
            {standing === null ? null : <TierMeter standing={standing} rows={history?.rows ?? []} t={t} locale={locale} />}
          </div>
          <PointsTrend rows={history?.rows ?? []} t={t} locale={locale} />
        </div>
      )}
    </Panel>
  );
}

function Ink({ children }: { children: ReactNode }) {
  return <span className="text-ink tabular-nums">{children}</span>;
}

/** The road to the next tier: a track from zero to its threshold, and what the rest of it costs
 *  in wins and in days at today's quota. Omitted at the top tier, which has no threshold ahead. */
function TierMeter({ standing, rows, t, locale }: { standing: PvpStanding; rows: readonly PvpDuelRow[]; t: Copy; locale: AppLocale }) {
  const step = pointsPerWin(rows);
  const eta = winsToNextTier(standing, step);
  if (standing.nextTierAt === null || eta === null) return null;
  const tier = tierNumberOf(standing.tier, standing.tierNumber);
  const nextTier = tierAfter(tier);
  const wins = <Ink>{sub(t.pvpStandingEtaWins, { wins: formatCount(eta.wins, locale) })}</Ink>;
  const stepFigure = <Ink>{formatCount(step, locale)}</Ink>;
  const etaNodes =
    eta.days === null
      ? subNodes(t.pvpStandingEta, { wins, step: stepFigure })
      : subNodes(t.pvpStandingEtaWithDays, {
          wins,
          step: stepFigure,
          days: <Ink>{sub(t.pvpStandingEtaDays, { days: formatCount(eta.days, locale) })}</Ink>,
        });

  return (
    <div data-testid="pvp-tier-meter" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {nextTier === null ? null : (
          <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">
            {sub(t.pvpStandingMeterLabel, { tier, next: nextTier })}
          </span>
        )}
        <span data-testid="pvp-tier-eta" className="ml-auto text-[11px] text-muted">
          {etaNodes}
        </span>
      </div>
      <Bar percent={tierMeterPercent(standing)} variant="best" />
      <div className="flex justify-between font-mono text-[10.5px] text-muted tabular-nums">
        <span>{formatCount(0, locale)}</span>
        <span className="text-ink">{formatCount(standing.points, locale)}</span>
        <span>{formatCount(standing.nextTierAt, locale)}</span>
      </div>
    </div>
  );
}

/** Points after each of the newest duels, oldest on the left, with the window's record above it.
 *  One duel is a dot, not a trend, so under two the block says what it is waiting for. */
function PointsTrend({ rows, t, locale }: { rows: readonly PvpDuelRow[]; t: Copy; locale: AppLocale }) {
  const window = trendWindow(rows);
  if (window.length < MIN_TREND_ROWS) {
    return (
      <p data-testid="pvp-points-trend" data-state="empty" className="m-0 self-end text-xs text-muted">
        {t.pvpStandingTrendEmpty}
      </p>
    );
  }
  const run = streak(window);
  const streakText =
    run === null ? '' : sub(run.result === 'won' ? t.pvpStandingStreakWon : t.pvpStandingStreakLost, { n: formatCount(run.length, locale) });
  const count = formatCount(window.length, locale);

  return (
    <div data-testid="pvp-points-trend" data-state="drawn" className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{t.pvpStandingTrendLabel}</span>
        <span data-testid="pvp-points-trend-summary" className="text-[11px] text-muted tabular-nums whitespace-nowrap">
          {sub(t.pvpStandingTrendSummary, { n: count, pct: formatCount(winRate(window) * 100, locale), streak: streakText })}
        </span>
      </div>
      <Sparkline
        values={pointsSeries(window)}
        marks={resultMarks(window)}
        domain="data"
        ariaLabel={sub(t.pvpStandingTrendAria, { n: count })}
        height={64}
        className="text-accent"
      />
      <div data-testid="pvp-points-trend-legend" className="flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
        <LegendEntry swatch="bg-up" label={t.pvpStandingLegendWon} />
        <LegendEntry swatch="bg-down" label={t.pvpStandingLegendLost} />
      </div>
    </div>
  );
}

function LegendEntry({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('size-2', 'shrink-0', 'rounded-full', swatch)} />
      {label}
    </span>
  );
}

/** A figure not read yet says so in place of its number, at a size that reads as an aside
 *  rather than as a headline made of words. */
function StandingFigure({
  label,
  testId,
  value,
  unread,
  note,
}: {
  label: string;
  testId: string;
  value: string | null;
  unread: string;
  note?: string;
}) {
  return (
    <FactTile
      size="headline"
      label={label}
      data-testid={testId}
      value={value ?? unread}
      {...(value === null ? { valueClassName: cn('text-sm', 'font-semibold', 'text-muted') } : {})}
      {...(note === undefined ? {} : { note })}
    />
  );
}
