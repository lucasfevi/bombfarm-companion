'use client';

import type { PvpHistoryResult } from '@bombfarm/contracts';
import { cn, FactTile, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount } from '../../lib/format';
import { duelsLeft, tierNumberOf } from '../../lib/pvp/pvp-rows';
import { usePvpRefresh } from '../../lib/pvp/use-pvp-refresh';
import { AccountRefreshControl } from '../account-refresh-control';

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
      )}
    </Panel>
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
