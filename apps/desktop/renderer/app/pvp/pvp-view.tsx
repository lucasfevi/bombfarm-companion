'use client';

/**
 * The PVP screen: the account's standing, asked for the moment the tab opens and refreshed by
 * every duel result, then every duel the app saw settle while it was open, newest first, with
 * whether each one's film is held. The list is what the game reported — nothing on it is
 * predicted, and a duel the app was closed for is not on it, because the tap was not there to
 * see it.
 */
import { useEffect, useMemo, useState } from 'react';
import type { PvpDuelRow, PvpHistoryResult } from '@bombfarm/contracts';
import { inventoryFieldHeightClass } from '@bombfarm/game-art';
import {
  cn,
  colClass,
  DataTable,
  EmptyState,
  FactTile,
  InfoTip,
  Panel,
  PanelHeader,
  SearchSelect,
  SegmentedToggle,
  Tooltip,
} from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount } from '../../lib/format';
import {
  ALL_OPPONENTS,
  duelsLeft,
  filterDuels,
  formatPointsDelta,
  headToHead,
  opponentNames,
  tierNumberOf,
  type PvpResultFilter,
} from '../../lib/pvp/pvp-rows';
import { refreshPvpStanding, usePvpHistory } from '../../lib/pvp/use-pvp-history';
import { usePvpRefresh } from '../../lib/pvp/use-pvp-refresh';
import { AccountRefreshControl } from '../account-refresh-control';

/** Twelve rows under the sticky header before the table scrolls: a session's quota several
 *  times over, and the screen still keeps its footnote in view. */
const TABLE_MAX_ROWS = 12;

export function PvpView() {
  const state = usePvpHistory();
  const history = state.status === 'ready' ? state.history : null;

  useEffect(() => {
    refreshPvpStanding();
  }, []);

  return (
    <Tooltip.Provider>
      <div data-testid="pvp-view" data-state={state.status} className={colClass}>
        <StandingPanel history={history} />
        <DuelHistoryPanel history={history} />
      </div>
    </Tooltip.Provider>
  );
}

function StandingPanel({ history }: { history: PvpHistoryResult | null }) {
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

function DuelHistoryPanel({ history }: { history: PvpHistoryResult | null }) {
  const t = useCopy();
  const { locale } = useLocale();
  const rows = useMemo(() => history?.rows ?? [], [history]);
  const empty = rows.length === 0;

  const [opponent, setOpponent] = useState<string>(ALL_OPPONENTS);
  const [result, setResult] = useState<PvpResultFilter>('all');

  const opponents = useMemo(() => opponentNames(rows), [rows]);
  const opponentOptions = useMemo(
    () => [{ value: ALL_OPPONENTS, label: t.pvpFilterOpponentAll }, ...opponents.map((name) => ({ value: name, label: name }))],
    [opponents, t.pvpFilterOpponentAll],
  );
  const chosenOpponent = opponents.includes(opponent) ? opponent : ALL_OPPONENTS;
  const shown = useMemo(() => filterDuels(rows, chosenOpponent, result), [rows, chosenOpponent, result]);
  const rivalry = useMemo(
    () => (chosenOpponent === ALL_OPPONENTS ? null : headToHead(rows, chosenOpponent)),
    [rows, chosenOpponent],
  );

  const resultOptions = [
    { id: 'all', label: t.pvpFilterResultAll },
    { id: 'won', label: t.pvpResultWon },
    { id: 'lost', label: t.pvpResultLost },
  ];

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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2" data-testid="pvp-filters">
            <SearchSelect
              size="compact"
              options={opponentOptions}
              value={chosenOpponent}
              onValueChange={setOpponent}
              aria-label={t.pvpFilterOpponentLabel}
              searchPlaceholder={t.pvpFilterOpponentSearch}
              emptyLabel={t.pvpFilterOpponentNoMatch}
              className={cn(inventoryFieldHeightClass, 'w-56', 'shrink-0')}
            />
            <SegmentedToggle
              options={resultOptions}
              value={result}
              onChange={(id) => {
                setResult(id as PvpResultFilter);
              }}
              ariaLabel={t.pvpFilterResultLabel}
              className={inventoryFieldHeightClass}
            />
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted" data-testid="pvp-filter-count">
              {sub(t.inventoryFilterCount, { shown: shown.length, total: rows.length })}
            </span>
          </div>
          {rivalry !== null ? (
            <div className="flex flex-wrap items-center gap-2" data-testid="pvp-head-to-head">
              <p className="m-0 mr-1 text-xs font-semibold text-ink">{sub(t.pvpHeadToHeadTitle, { name: chosenOpponent })}</p>
              <FactTile
                label={t.pvpHeadToHeadDuels}
                value={formatCount(rivalry.duels, locale)}
                data-testid="pvp-head-to-head-duels"
              />
              <FactTile
                label={t.pvpHeadToHeadWon}
                value={formatCount(rivalry.won, locale)}
                valueClassName="text-up"
                data-testid="pvp-head-to-head-won"
              />
              <FactTile
                label={t.pvpHeadToHeadLost}
                value={formatCount(rivalry.lost, locale)}
                valueClassName="text-down"
                data-testid="pvp-head-to-head-lost"
              />
              <FactTile
                label={t.pvpHeadToHeadScore}
                value={sub(t.pvpScore, {
                  yours: formatCount(rivalry.yourScore, locale),
                  theirs: formatCount(rivalry.theirScore, locale),
                })}
                note={t.pvpScoreHint}
                data-testid="pvp-head-to-head-score"
              />
            </div>
          ) : null}
          {shown.length === 0 ? (
            <p className="m-0 text-xs text-muted" data-testid="pvp-filter-empty">
              {t.pvpFilterEmpty}
            </p>
          ) : (
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
                  {shown.map((row) => (
                    <DuelRow key={row.id} row={row} />
                  ))}
                </DataTable.Body>
              </DataTable.Table>
            </DataTable.Root>
          )}
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
      <DataTable.Cell align="right" numeric data-testid="pvp-phase">
        {sub(t.pvpPhaseCell, {
          phase: formatCount(row.phase, locale),
          tier: tierNumberOf(row.tier),
          floor: formatCount(row.tierFloor, locale),
        })}
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
