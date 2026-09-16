'use client';

/**
 * The PVP screen: the account's standing as the game last reported it, then every duel the app
 * saw settle while it was open, newest first, and whether each one's film is held. The list is
 * what the game reported — nothing on it is predicted, and a duel the app was closed for is not on
 * it, because the tap was not there to see it.
 */
import type { ReactNode } from 'react';
import type { PvpDuelRow, PvpHistoryResult } from '@bombfarm/contracts';
import { cn, colClass, DataTable, EmptyState, InfoTip, Panel, PanelHeader, Tooltip } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount } from '../../lib/format';
import { duelsLeft, formatPointsDelta } from '../../lib/pvp/pvp-rows';
import { usePvpHistory } from '../../lib/pvp/use-pvp-history';

/** Twelve rows under the sticky header before the table scrolls: a session's quota several
 *  times over, and the screen still keeps its footnote in view. */
const TABLE_MAX_ROWS = 12;

export function PvpView() {
  const state = usePvpHistory();
  const history = state.status === 'ready' ? state.history : null;

  return (
    <Tooltip.Provider>
      <div data-testid="pvp-view" data-state={state.status} className={colClass}>
        <StandingPanel history={history} />
        <DuelHistoryPanel history={history} />
      </div>
    </Tooltip.Provider>
  );
}

function Figure({ label, value, note, testId }: { label: string; value: ReactNode; note: ReactNode; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={testId}>
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span className="text-[15px] font-bold tabular-nums text-ink">{value}</span>
      <span className="min-h-[11px] text-[11px] leading-none text-muted">{note}</span>
    </div>
  );
}

function StandingPanel({ history }: { history: PvpHistoryResult | null }) {
  const t = useCopy();
  const { locale } = useLocale();
  const standing = history?.standing ?? null;
  const rank = history?.rank ?? null;
  const quota = history === null ? null : duelsLeft(history);

  return (
    <Panel data-testid="pvp-standing" data-state={standing === null ? 'empty' : 'read'}>
      <PanelHeader title={t.pvpStandingTitle}>
        {standing !== null ? (
          <span className="text-xs text-muted" data-testid="pvp-standing-age">
            {sub(t.pvpStandingAge, { age: formatCapturedAt(standing.capturedAt, t) })}
          </span>
        ) : null}
      </PanelHeader>
      {standing === null && quota === null && rank === null ? (
        <p className="m-0 text-xs text-muted">{t.pvpStandingEmpty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
          <Figure
            label={t.pvpStandingPoints}
            testId="pvp-standing-points"
            value={standing === null ? t.pvpStandingUnknown : formatCount(standing.points, locale)}
            note={
              standing === null
                ? null
                : standing.nextTierAt === null
                  ? sub(t.pvpStandingTierNoNext, { tier: standing.tier })
                  : sub(t.pvpStandingTier, { tier: standing.tier, next: formatCount(standing.nextTierAt, locale) })
            }
          />
          <Figure
            label={t.pvpStandingDuels}
            testId="pvp-standing-duels"
            value={quota === null ? t.pvpStandingUnknown : sub(t.pvpStandingDuelsValue, { left: quota.left, max: quota.max })}
            note={null}
          />
          <Figure
            label={t.pvpStandingSlots}
            testId="pvp-standing-slots"
            value={
              standing === null || standing.slots === null
                ? t.pvpStandingUnknown
                : sub(t.pvpStandingSlotsValue, { slots: standing.slots, max: standing.slotsMax ?? standing.slots })
            }
            note={null}
          />
          <Figure
            label={t.pvpStandingRank}
            testId="pvp-standing-rank"
            value={rank === null ? t.pvpStandingUnknown : sub(t.pvpStandingRankValue, { position: formatCount(rank.position, locale) })}
            note={
              rank === null
                ? t.pvpStandingRankUnknown
                : sub(t.pvpStandingRankAge, { age: formatCapturedAt(rank.capturedAt, t), points: formatCount(rank.points, locale) })
            }
          />
        </div>
      )}
    </Panel>
  );
}

function DuelHistoryPanel({ history }: { history: PvpHistoryResult | null }) {
  const t = useCopy();
  const { locale } = useLocale();
  const empty = history === null || history.rows.length === 0;

  return (
    <Panel data-testid="pvp-history" data-state={empty ? 'empty' : 'duels'}>
      <PanelHeader title={t.pvpTitle}>
        {history !== null && !empty ? (
          <span className="text-xs tabular-nums text-muted" data-testid="pvp-summary">
            {sub(t.pvpSummary, {
              duels: formatCount(history.totals.duels, locale),
              won: formatCount(history.totals.won, locale),
              films: formatCount(history.totals.films, locale),
            })}
          </span>
        ) : null}
      </PanelHeader>
      {empty ? (
        <EmptyState title={t.pvpEmptyTitle} description={t.pvpEmptyDescription} headingLevel={3} />
      ) : (
        <div className="flex flex-col gap-2">
          <DataTable.Root scrollable maxRows={TABLE_MAX_ROWS}>
            <DataTable.Table>
              <DataTable.Caption>{t.pvpCaption}</DataTable.Caption>
              <DataTable.Head>
                <DataTable.Row>
                  <DataTable.Header scope="col">{t.pvpColumnWhen}</DataTable.Header>
                  <DataTable.Header scope="col">{t.pvpColumnOpponent}</DataTable.Header>
                  <DataTable.Header scope="col">{t.pvpColumnResult}</DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    <span className="inline-flex items-center gap-1">
                      {t.pvpColumnScore}
                      <InfoTip label={t.pvpColumnScore} tip={t.pvpScoreHint} />
                    </span>
                  </DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    <span className="inline-flex items-center gap-1">
                      {t.pvpColumnPhase}
                      <InfoTip label={t.pvpColumnPhase} tip={t.pvpPhaseHint} />
                    </span>
                  </DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    {t.pvpColumnPoints}
                  </DataTable.Header>
                  <DataTable.Header scope="col">{t.pvpColumnFilm}</DataTable.Header>
                </DataTable.Row>
              </DataTable.Head>
              <DataTable.Body data-testid="pvp-history-body">
                {history.rows.map((row) => (
                  <DuelRow key={row.id} row={row} />
                ))}
              </DataTable.Body>
            </DataTable.Table>
          </DataTable.Root>
          <p className="m-0 text-xs text-muted" data-testid="pvp-film-note">
            {t.pvpFilmNote}
          </p>
        </div>
      )}
    </Panel>
  );
}

function DuelRow({ row }: { row: PvpDuelRow }) {
  const t = useCopy();
  const { locale } = useLocale();

  return (
    <DataTable.Row data-testid="pvp-duel-row" data-duel-id={row.id} data-film-stored={row.filmStored ? 'true' : 'false'}>
      <DataTable.RowHeader>{formatCapturedAt(row.recordedAt, t)}</DataTable.RowHeader>
      <DataTable.Cell nowrap={false}>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="truncate" data-testid="pvp-opponent">
            {row.defender.name}
          </span>
          <span className="shrink-0 text-xs text-muted">{sub(t.pvpOpponentHeroes, { n: row.defender.heroes })}</span>
        </span>
      </DataTable.Cell>
      <DataTable.Cell>
        <span data-testid="pvp-result" className={cn('font-semibold', row.won ? 'text-up' : 'text-down')}>
          {row.won ? t.pvpResultWon : t.pvpResultLost}
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid="pvp-score">
        {sub(t.pvpScore, {
          yours: formatCount(row.attacker.score, locale),
          theirs: formatCount(row.defender.score, locale),
        })}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        <span className="flex flex-col items-end">
          <span data-testid="pvp-phase">{formatCount(row.phase, locale)}</span>
          <span className="font-sans text-xs text-muted" data-testid="pvp-tier-floor">
            {sub(t.pvpTierFloor, { tier: row.tier, floor: formatCount(row.tierFloor, locale) })}
          </span>
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        <span className="flex items-baseline justify-end gap-2">
          <span data-testid="pvp-points">
            {sub(t.pvpPoints, {
              before: formatCount(row.pointsBefore, locale),
              after: formatCount(row.pointsAfter, locale),
            })}
          </span>
          <span
            data-testid="pvp-points-delta"
            className={cn('text-xs', row.pointsAfter >= row.pointsBefore ? 'text-up' : 'text-down')}
          >
            {formatPointsDelta(row, locale)}
          </span>
        </span>
      </DataTable.Cell>
      <DataTable.Cell data-testid="pvp-film" className={row.filmStored ? undefined : 'text-muted'}>
        {row.filmStored ? t.pvpFilmStored : t.pvpFilmMissing}
      </DataTable.Cell>
    </DataTable.Row>
  );
}
