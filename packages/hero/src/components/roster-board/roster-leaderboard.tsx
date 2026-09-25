'use client';

/**
 * The roster as a leaderboard: one row per hero, every column sortable, so a player can line the
 * whole account up by any one figure and read who leads it.
 *
 * Read-only, like the cards. A row selects a hero and changes nothing.
 */
import { memo, useMemo, type KeyboardEvent } from 'react';
import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import {
  HeroAvatar,
  inventoryTableRowClass,
  inventoryTableSelectedRowClass,
  rarityTextClass,
  rosterInactiveChromeClass,
} from '@bombfarm/game-art';
import {
  DataTable,
  Panel,
  SegmentedToggle,
  cn,
  formatNumber,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
} from '@bombfarm/ui';
import { showcaseCopyFor, type Lang, type RosterBoardCopy, type ShowcaseCopy } from '../../copy';
import {
  LEADERBOARD_COLUMNS,
  LEADERBOARD_FILTERS,
  LEADERBOARD_FILTER_LABELS,
  LEADERBOARD_STAT_COLUMN_IDS,
  filterLeaderboardRows,
  heroPowerText,
  leaderboardGearText,
  leaderboardPowerPercent,
  leaderboardRowsFor,
  leaderboardStatValue,
  percentText,
  pressLeaderboardColumn,
  sheetTotalText,
  sortLeaderboardRows,
  type LeaderboardColumn,
  type LeaderboardFilter,
  type LeaderboardRow,
  type LeaderboardView,
  type RosterHeroRow,
  type SortableLeaderboardColumnId,
} from '../../model';
import { BirthGradeChip } from './birth-grade-chip';

const NOT_PLACED = '—';

const LEFT_ALIGNED_COLUMNS: ReadonlySet<LeaderboardColumn['id']> = new Set(['name', 'rarity']);

const TABLE_MIN_WIDTH_CLASS = 'min-w-[980px]';

export function RosterLeaderboard({
  rows,
  tree,
  withheldHeroIds,
  view,
  onViewChange,
  selectedId,
  onSelectHeroId,
  t,
  lang,
}: {
  /** Already narrowed by the toolbar above this panel; the table orders them itself. */
  rows: readonly RosterHeroRow[];
  /** The account's skill-tree totals, or `null` while unread — every statistic is then blank. */
  tree: TreeSheetTotals | null;
  /** Heroes whose statistics the host withholds; their cells print a dash and sort last. */
  withheldHeroIds?: ReadonlySet<string>;
  view: LeaderboardView;
  onViewChange: (next: LeaderboardView) => void;
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  const copy = showcaseCopyFor(lang);
  const boardRows = useMemo(
    () => leaderboardRowsFor(rows, { tree, withheldHeroIds }),
    [rows, tree, withheldHeroIds],
  );
  const topPower = useMemo(
    () => boardRows.reduce((top, row) => Math.max(top, row.hero.power ?? 0), 0),
    [boardRows],
  );
  const shownRows = useMemo(
    () => sortLeaderboardRows(filterLeaderboardRows(boardRows, view.filter), view.sort.column, view.sort.direction),
    [boardRows, view],
  );
  const filterOptions = useMemo(
    () => LEADERBOARD_FILTERS.map((id) => ({ id, label: copy[LEADERBOARD_FILTER_LABELS[id]] })),
    [copy],
  );

  const onSort = (column: SortableLeaderboardColumnId) => {
    onViewChange({ ...view, sort: pressLeaderboardColumn(view.sort, column) });
  };

  return (
    <Panel className="min-w-0" data-testid="heroes-leaderboard">
      <div className={cn(panelHClass, 'items-center')}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
      </div>
      <div className="mb-2.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <SegmentedToggle
          options={filterOptions}
          value={view.filter}
          onChange={(next) => {
            onViewChange({ ...view, filter: next as LeaderboardFilter });
          }}
          ariaLabel={copy.tableFilterLabel}
        />
        <span className="text-xs text-muted">{copy.tableHint}</span>
      </div>
      <DataTable.Root className="min-w-0 overflow-x-auto rounded-sm border border-line">
        <DataTable.Table className={TABLE_MIN_WIDTH_CLASS} aria-label={copy.tableLabel}>
          <DataTable.Head>
            <DataTable.Row>
              {LEADERBOARD_COLUMNS.map((column) => {
                const align = LEFT_ALIGNED_COLUMNS.has(column.id) ? 'left' : 'right';
                const label = copy[column.label];
                if (column.id === 'position') {
                  return (
                    <DataTable.Header key={column.id} align={align}>
                      {label}
                    </DataTable.Header>
                  );
                }
                return (
                  <DataTable.Header
                    key={column.id}
                    sortable
                    col={column.id}
                    sortKey={view.sort.column}
                    sortDir={view.sort.direction}
                    onSort={onSort}
                    align={align}
                    data-testid={`heroes-leaderboard-sort-${column.id}`}
                  >
                    {label}
                  </DataTable.Header>
                );
              })}
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {shownRows.length === 0 ? (
              <DataTable.Row>
                <DataTable.Cell colSpan={LEADERBOARD_COLUMNS.length} className="text-muted">
                  {copy.tableEmpty}
                </DataTable.Cell>
              </DataTable.Row>
            ) : (
              shownRows.map((row, index) => (
                <LeaderboardTableRow
                  key={row.id}
                  row={row}
                  position={index + 1}
                  topPower={topPower}
                  selected={row.id === selectedId}
                  copy={copy}
                  lang={lang}
                  onSelectHeroId={onSelectHeroId}
                />
              ))
            )}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </Panel>
  );
}

/** Memoised by hand for the reason the cards are: the React Compiler does not run over a package
 *  a host lists in `transpilePackages`. */
const LeaderboardTableRow = memo(function LeaderboardTableRow({
  row,
  position,
  topPower,
  selected,
  copy,
  lang,
  onSelectHeroId,
}: {
  row: LeaderboardRow;
  position: number;
  topPower: number;
  selected: boolean;
  copy: ShowcaseCopy;
  lang: Lang;
  onSelectHeroId: (heroId: string) => void;
}) {
  const { hero } = row;
  const format = numberFormatterFor(lang);
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectHeroId(row.id);
    }
  };

  return (
    <DataTable.Row
      data-testid={`heroes-leaderboard-row-${row.id}`}
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      onClick={() => {
        onSelectHeroId(row.id);
      }}
      onKeyDown={onKeyDown}
      className={cn(
        inventoryTableRowClass,
        'cursor-pointer',
        'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]',
        selected ? inventoryTableSelectedRowClass : undefined,
        hero.battleAllowed === false ? rosterInactiveChromeClass : undefined,
      )}
    >
      <DataTable.Cell align="right" numeric className="text-muted" data-testid="heroes-leaderboard-position">
        {position}
      </DataTable.Cell>
      <DataTable.Cell>
        <HeroCell row={row} />
      </DataTable.Cell>
      <DataTable.Cell>
        <span className={cn('font-bold', rarityTextClass(Math.max(0, RARITIES.indexOf(hero.rarity))))}>
          {rarityLabel(hero.rarity, lang)}
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatNumber(hero.level, lang, 0)}
      </DataTable.Cell>
      <DataTable.Cell align="right">
        <BirthCell row={row} copy={copy} lang={lang} />
      </DataTable.Cell>
      <DataTable.Cell align="right">
        <PowerCell row={row} topPower={topPower} lang={lang} />
      </DataTable.Cell>
      {LEADERBOARD_STAT_COLUMN_IDS.map((column) => {
        const value = leaderboardStatValue(row, column);
        return (
          <DataTable.Cell key={column} align="right" numeric data-testid={`heroes-leaderboard-stat-${column}`}>
            {value === undefined ? NOT_PLACED : sheetTotalText(column, value, format)}
          </DataTable.Cell>
        );
      })}
      <DataTable.Cell align="right" numeric>
        {formatNumber(row.abilityCount, lang, 0)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid="heroes-leaderboard-gear">
        {leaderboardGearText(row, copy, lang)}
      </DataTable.Cell>
    </DataTable.Row>
  );
});

function HeroCell({ row }: { row: LeaderboardRow }) {
  const { hero } = row;
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars)));
  return (
    <span className="flex min-w-0 items-center gap-2">
      <HeroAvatar
        skin={hero.skin ?? 0}
        rarityIdx={Math.max(0, RARITIES.indexOf(hero.rarity))}
        size="sm"
        name={hero.name}
      />
      <span className="truncate font-semibold text-ink">{hero.name}</span>
      {stars > 0 ? (
        <span className="shrink-0 text-[11px] leading-none tracking-tight text-rar-4" aria-hidden>
          {'★'.repeat(stars)}
        </span>
      ) : null}
    </span>
  );
}

function BirthCell({ row, copy, lang }: { row: LeaderboardRow; copy: ShowcaseCopy; lang: Lang }) {
  if (row.report === undefined) return <span className="text-muted">{NOT_PLACED}</span>;
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="heroes-leaderboard-birth">
      <span className="font-mono tabular-nums">{percentText(row.report.mean, lang)}</span>
      {row.gradeLetter === undefined ? null : (
        <BirthGradeChip grade={row.gradeLetter} copy={copy} size="sm" testId="heroes-leaderboard-grade" />
      )}
    </span>
  );
}

function PowerCell({ row, topPower, lang }: { row: LeaderboardRow; topPower: number; lang: Lang }) {
  const percent = leaderboardPowerPercent(row.hero.power, topPower);
  return (
    <span className="inline-grid grid-cols-[auto_4.5rem] items-center justify-end gap-2">
      <span className="font-mono font-semibold tabular-nums text-ink" data-testid="heroes-leaderboard-power">
        {heroPowerText(row, lang)}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--line)_70%,transparent)]" aria-hidden>
        <span className="block h-full rounded-full bg-accent" style={{ width: `${String(percent)}%` }} />
      </span>
    </span>
  );
}
