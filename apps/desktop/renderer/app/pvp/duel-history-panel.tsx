'use client';

import { useMemo } from 'react';
import type { PvpDuelRow, PvpHistoryResult } from '@bombfarm/contracts';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { HeroAvatar, heroPeekData, inventoryFieldHeightClass, useHeroPeekStats } from '@bombfarm/game-art';
import { Button, cn, DataTable, EmptyState, FactTile, InfoTip, Panel, PanelHeader, SearchSelect, SegmentedToggle } from '@bombfarm/ui';
import { buildAccountRoster } from '../../lib/account/account-roster';
import { useAccountView } from '../../lib/account/use-account-view';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount } from '../../lib/format';
import {
  ALL_OPPONENTS,
  filterDuels,
  formatPointsDelta,
  headToHead,
  opponentNames,
  tierNumberOf,
  type PvpResultFilter,
} from '../../lib/pvp/pvp-rows';
import { DUEL_ROW_HEIGHT_PX, HEADER_HEIGHT_PX, VISIBLE_ROWS } from '../../lib/pvp/pvp-table-rows';
import { usePvpFilters } from '../../lib/pvp/use-pvp-filters';
import { scrollportHeightPx, useRowWindow } from '../../lib/row-window';
import { RowWindowSpacer } from '../../lib/row-window-spacer';

const COLUMNS = 8;
const SCROLLPORT_HEIGHT_PX = scrollportHeightPx(VISIBLE_ROWS, DUEL_ROW_HEIGHT_PX, HEADER_HEIGHT_PX);

type HeroById = ReadonlyMap<string, HeroRecord>;

const NO_HEROES: HeroById = new Map();

export function DuelHistoryPanel({
  history,
  onOpenReplay,
  openFilmId = null,
}: {
  history: PvpHistoryResult | null;
  /** Given, a row whose film is held offers to open it; the replay panel is the view's to draw. */
  onOpenReplay?: (row: PvpDuelRow) => void;
  openFilmId?: number | null;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const rows = useMemo(() => history?.rows ?? [], [history]);
  const empty = rows.length === 0;

  const { opponent, result, setOpponent, setResult } = usePvpFilters();
  const account = useAccountView();
  const heroById = useMemo<HeroById>(() => {
    if (account.status !== 'loaded') return NO_HEROES;
    const roster = buildAccountRoster(account.view);
    return roster === null ? NO_HEROES : new Map(roster.heroes.map((hero) => [hero.id, hero]));
  }, [account]);

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
  const windowed = useRowWindow(shown, VISIBLE_ROWS, DUEL_ROW_HEIGHT_PX);

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
            <DataTable.Root
              scrollable
              style={{ maxHeight: SCROLLPORT_HEIGHT_PX }}
              onScroll={windowed.onScroll}
              data-testid="pvp-history-scroll"
            >
              <DataTable.Table aria-rowcount={windowed.total}>
                <DataTable.Caption>{t.pvpCaption}</DataTable.Caption>
                <DataTable.Head>
                  <DataTable.Row>
                    <DataTable.Header scope="col">{t.pvpColumnWhen}</DataTable.Header>
                    <DataTable.Header scope="col">
                      <span className="inline-flex items-center gap-1">
                        {t.pvpSquadColumn}
                        <InfoTip label={t.pvpSquadColumn} tip={t.pvpSquadHint} />
                      </span>
                    </DataTable.Header>
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
                  {windowed.start > 0 ? (
                    <RowWindowSpacer
                      testId="pvp-history-spacer-top"
                      rows={windowed.start}
                      rowHeightPx={DUEL_ROW_HEIGHT_PX}
                      colSpan={COLUMNS}
                    />
                  ) : null}
                  {windowed.rows.map((row, index) => (
                    <DuelRow
                      key={row.id}
                      row={row}
                      heroById={heroById}
                      onOpenReplay={onOpenReplay}
                      open={openFilmId !== null && row.filmId === openFilmId}
                      ariaRowIndex={windowed.start + index + 1}
                    />
                  ))}
                  {windowed.end < windowed.total ? (
                    <RowWindowSpacer
                      testId="pvp-history-spacer-bottom"
                      rows={windowed.total - windowed.end}
                      rowHeightPx={DUEL_ROW_HEIGHT_PX}
                      colSpan={COLUMNS}
                    />
                  ) : null}
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

function DuelRow({
  row,
  heroById,
  onOpenReplay,
  open,
  ariaRowIndex,
}: {
  row: PvpDuelRow;
  heroById: HeroById;
  onOpenReplay: ((row: PvpDuelRow) => void) | undefined;
  open: boolean;
  ariaRowIndex: number;
}) {
  const t = useCopy();
  const { locale } = useLocale();

  return (
    <DataTable.Row
      data-testid="pvp-duel-row"
      data-duel-id={row.id}
      data-film-stored={row.filmStored ? 'true' : 'false'}
      aria-rowindex={ariaRowIndex}
      style={{ height: DUEL_ROW_HEIGHT_PX }}
    >
      <DataTable.RowHeader>{formatCapturedAt(row.recordedAt, t)}</DataTable.RowHeader>
      <DataTable.Cell data-testid="pvp-squad" data-count={row.squadHeroIds.length}>
        <SquadStack heroIds={row.squadHeroIds} heroById={heroById} />
      </DataTable.Cell>
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
        {row.filmStored && onOpenReplay !== undefined ? (
          <Button
            type="button"
            variant={open ? 'primary' : 'default'}
            className={cn('whitespace-nowrap', 'px-2', 'py-1')}
            data-testid="pvp-open-replay"
            aria-pressed={open}
            onClick={() => {
              onOpenReplay(row);
            }}
          >
            {t.pvpFilmReplay}
          </Button>
        ) : row.filmStored ? (
          t.pvpFilmStored
        ) : (
          t.pvpFilmMissing
        )}
      </DataTable.Cell>
    </DataTable.Row>
  );
}

/** The heroes fielded, in slot order, overlapping like a hand of cards, each opening its own
 *  card on hover — lifted above its neighbours while it does, since the next card in the hand
 *  covers its edge. A hero the roster no longer carries keeps its slot as a framed question mark,
 *  so the stack is as long as the squad was. */
function SquadStack({ heroIds, heroById }: { heroIds: readonly string[]; heroById: HeroById }) {
  const t = useCopy();
  const { lang } = useLocale();
  const peekStats = useHeroPeekStats();
  if (heroIds.length === 0) return <span aria-hidden>—</span>;
  return (
    <span className="flex items-center">
      {heroIds.map((heroId, index) => {
        const hero = heroById.get(heroId);
        const overlap = index === 0 ? undefined : '-ml-1.5';
        return hero === undefined ? (
          <span
            key={`${heroId}-${String(index)}`}
            role="img"
            aria-label={t.pvpSquadUnknownHero}
            data-testid="pvp-squad-unknown"
            className={cn(
              'inline-grid',
              'size-6',
              'shrink-0',
              'place-items-center',
              'rounded-sm',
              'border',
              'border-dashed',
              'border-line',
              'bg-bg-2',
              'text-[10px]',
              'text-muted',
              overlap,
            )}
          >
            {t.pvpSquadUnknownMark}
          </span>
        ) : (
          <HeroAvatar
            key={`${heroId}-${String(index)}`}
            skin={hero.skin ?? 0}
            rarityIdx={RARITIES.indexOf(hero.rarity)}
            size="xs"
            name={hero.name}
            className="size-6"
            peek={{ hero: heroPeekData(hero, peekStats(hero)), lang, className: cn('relative', 'hover:z-[1]', overlap) }}
          />
        );
      })}
    </span>
  );
}
