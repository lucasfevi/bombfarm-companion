'use client';

/**
 * The roster as a leaderboard: one row per hero, every column sortable, so a player can line the
 * whole account up by any one figure and read who leads it. The player picks which columns show.
 *
 * Read-only, like the cards. A row selects a hero and changes nothing.
 */
import { memo, useMemo, type KeyboardEvent } from 'react';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import {
  HeroAbilityIcons,
  HeroAvatar,
  heroPeekData,
  inventoryTableRowClass,
  inventoryTableSelectedRowClass,
  rarityTextClass,
  rosterInactiveChromeClass,
} from '@bombfarm/game-art';
import {
  DataTable,
  InfoTip,
  Panel,
  SearchSelectMultiple,
  SegmentedToggle,
  Tooltip,
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
  TOGGLEABLE_LEADERBOARD_COLUMN_IDS,
  filterLeaderboardRows,
  heroPowerText,
  isLeaderboardStatColumn,
  isToggleableLeaderboardColumn,
  leaderboardGearText,
  leaderboardMinWidthRem,
  leaderboardPowerPercent,
  leaderboardRowsFor,
  leaderboardStatValue,
  percentText,
  pressLeaderboardColumn,
  sheetTotalText,
  shownToggleableLeaderboardColumns,
  sortLeaderboardRows,
  visibleLeaderboardColumns,
  withShownLeaderboardColumns,
  type LeaderboardColumn,
  type LeaderboardColumnId,
  type LeaderboardFilter,
  type LeaderboardRow,
  type LeaderboardStatSource,
  type LeaderboardView,
  type RosterHeroRow,
  type SortableLeaderboardColumnId,
} from '../../model';
import { BirthGradeLetter } from './birth-grade-letter';

const NOT_PLACED = '—';

const LEFT_ALIGNED_COLUMNS: ReadonlySet<LeaderboardColumn['id']> = new Set(['name', 'rarity']);

const COLUMN_LABEL_BY_ID = new Map(LEADERBOARD_COLUMNS.map((column) => [column.id, column.label]));

export function RosterLeaderboard({
  rows,
  statSource,
  view,
  onViewChange,
  selectedId,
  onSelectHeroId,
  t,
  lang,
}: {
  /** Already narrowed by the toolbar above this panel; the table orders them itself. */
  rows: readonly RosterHeroRow[];
  /** The skill tree the statistics compose against, and the heroes whose figures the host
   *  withholds — one object so a host passes one memoised reference. */
  statSource: LeaderboardStatSource;
  view: LeaderboardView;
  onViewChange: (next: LeaderboardView) => void;
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  const copy = showcaseCopyFor(lang);
  const boardRows = useMemo(
    () => leaderboardRowsFor(rows, statSource),
    [rows, statSource],
  );
  const topPower = useMemo(
    () => boardRows.reduce((top, row) => Math.max(top, row.hero.power ?? 0), 0),
    [boardRows],
  );
  const shownRows = useMemo(
    () => sortLeaderboardRows(filterLeaderboardRows(boardRows, view.filter), view.sort.column, view.sort.direction),
    [boardRows, view],
  );
  const columns = useMemo(() => visibleLeaderboardColumns(view), [view]);
  const filterOptions = useMemo(
    () => LEADERBOARD_FILTERS.map((id) => ({ id, label: copy[LEADERBOARD_FILTER_LABELS[id]] })),
    [copy],
  );

  const onSort = (column: SortableLeaderboardColumnId) => {
    onViewChange({ ...view, sort: pressLeaderboardColumn(view.sort, column) });
  };

  return (
    <Panel className="min-w-0" data-testid="heroes-leaderboard">
      <Tooltip.Provider delay={200} closeDelay={100}>
        <div className={cn(panelHClass, 'items-center')}>
          <span className="flex items-center gap-1.5">
            <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
            <InfoTip label={t.heroesRosterTitle} tip={copy.tableHint} />
          </span>
        </div>
      </Tooltip.Provider>
      <div className="mb-2.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <SegmentedToggle
          options={filterOptions}
          value={view.filter}
          onChange={(next) => {
            onViewChange({ ...view, filter: next as LeaderboardFilter });
          }}
          ariaLabel={copy.tableFilterLabel}
        />
        <ColumnsMenu view={view} onViewChange={onViewChange} copy={copy} />
      </div>
      <DataTable.Root className="min-w-0 overflow-x-auto rounded-sm border border-line">
        <DataTable.Table
          aria-label={copy.tableLabel}
          style={{ minWidth: `${String(leaderboardMinWidthRem(columns))}rem` }}
        >
          <DataTable.Head>
            <DataTable.Row>
              {columns.map((column) => {
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
                <DataTable.Cell colSpan={columns.length} className="text-muted">
                  {copy.tableEmpty}
                </DataTable.Cell>
              </DataTable.Row>
            ) : (
              shownRows.map((row, index) => (
                <LeaderboardTableRow
                  key={row.id}
                  row={row}
                  columns={columns}
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
  columns,
  position,
  topPower,
  selected,
  copy,
  lang,
  onSelectHeroId,
}: {
  row: LeaderboardRow;
  columns: readonly LeaderboardColumn[];
  position: number;
  topPower: number;
  selected: boolean;
  copy: ShowcaseCopy;
  lang: Lang;
  onSelectHeroId: (heroId: string) => void;
}) {
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
        row.hero.battleAllowed === false ? rosterInactiveChromeClass : undefined,
      )}
    >
      {columns.map((column) => (
        <LeaderboardCell
          key={column.id}
          column={column.id}
          row={row}
          position={position}
          topPower={topPower}
          copy={copy}
          lang={lang}
        />
      ))}
    </DataTable.Row>
  );
});

function LeaderboardCell({
  column,
  row,
  position,
  topPower,
  copy,
  lang,
}: {
  column: LeaderboardColumnId;
  row: LeaderboardRow;
  position: number;
  topPower: number;
  copy: ShowcaseCopy;
  lang: Lang;
}) {
  const { hero } = row;
  if (isLeaderboardStatColumn(column)) {
    const value = leaderboardStatValue(row, column);
    return (
      <DataTable.Cell align="right" numeric data-testid={`heroes-leaderboard-stat-${column}`}>
        {value === undefined ? NOT_PLACED : sheetTotalText(column, value, numberFormatterFor(lang))}
      </DataTable.Cell>
    );
  }
  switch (column) {
    case 'position':
      return (
        <DataTable.Cell align="right" numeric className="text-muted" data-testid="heroes-leaderboard-position">
          {position}
        </DataTable.Cell>
      );
    case 'name':
      return (
        <DataTable.Cell>
          <HeroCell row={row} lang={lang} />
        </DataTable.Cell>
      );
    case 'rarity':
      return (
        <DataTable.Cell>
          <span className={cn('font-bold', rarityTextClass(Math.max(0, RARITIES.indexOf(hero.rarity))))}>
            {rarityLabel(hero.rarity, lang)}
          </span>
        </DataTable.Cell>
      );
    case 'level':
      return (
        <DataTable.Cell align="right" numeric>
          {formatNumber(hero.level, lang, 0)}
        </DataTable.Cell>
      );
    case 'birth':
      return (
        <DataTable.Cell align="right">
          <BirthCell row={row} copy={copy} lang={lang} />
        </DataTable.Cell>
      );
    case 'power':
      return (
        <DataTable.Cell align="right">
          <PowerCell row={row} topPower={topPower} lang={lang} />
        </DataTable.Cell>
      );
    case 'abilities':
      return (
        <DataTable.Cell align="right" data-testid="heroes-leaderboard-abilities">
          <HeroAbilityIcons abilities={hero.abilities} lang={lang} size="xs" showLevel={false} className="flex-nowrap" />
        </DataTable.Cell>
      );
    case 'gear':
      return (
        <DataTable.Cell align="right" numeric data-testid="heroes-leaderboard-gear">
          {leaderboardGearText(row, copy, lang)}
        </DataTable.Cell>
      );
  }
}

/**
 * The avatar opens the hero's card, as a picker row's does. Its click is left to reach the row,
 * so picking by the portrait picks exactly as picking by the row does.
 */
function HeroCell({ row, lang }: { row: LeaderboardRow; lang: Lang }) {
  const { hero } = row;
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars)));
  return (
    <span className="flex min-w-0 items-center gap-2">
      <HeroAvatar
        skin={hero.skin ?? 0}
        rarityIdx={Math.max(0, RARITIES.indexOf(hero.rarity))}
        size="sm"
        name={hero.name}
        peek={{ hero: heroPeekData(hero), lang }}
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

/** The roll beside the grade letter in the colour the game prints it — no chip, as the hero
 *  identity block draws a grade. */
function BirthCell({ row, copy, lang }: { row: LeaderboardRow; copy: ShowcaseCopy; lang: Lang }) {
  if (row.report === undefined) return <span className="text-muted">{NOT_PLACED}</span>;
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="heroes-leaderboard-birth">
      <span className="font-mono tabular-nums">{percentText(row.report.mean, lang)}</span>
      {row.gradeLetter === undefined ? null : (
        <BirthGradeLetter grade={row.gradeLetter} copy={copy} testId="heroes-leaderboard-grade" />
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

/** Every column but the position and the hero, each a tick the player turns on or off — the
 *  inventory's set filter with a field to find a column by name. */
function ColumnsMenu({
  view,
  onViewChange,
  copy,
}: {
  view: LeaderboardView;
  onViewChange: (next: LeaderboardView) => void;
  copy: ShowcaseCopy;
}) {
  const options = useMemo(
    () =>
      TOGGLEABLE_LEADERBOARD_COLUMN_IDS.map((column) => {
        const label = COLUMN_LABEL_BY_ID.get(column);
        return { value: column, label: label === undefined ? column : copy[label] };
      }),
    [copy],
  );
  const shown = shownToggleableLeaderboardColumns(view);
  const showColumns = (next: readonly string[]) => {
    onViewChange(withShownLeaderboardColumns(view, next.filter(isToggleableLeaderboardColumn)));
  };
  const everythingShown = shown.length === TOGGLEABLE_LEADERBOARD_COLUMN_IDS.length;
  return (
    <SearchSelectMultiple
      size="compact"
      aria-label={copy.tableColumns}
      className="ml-auto h-[30px] w-36 shrink-0"
      options={options}
      value={shown}
      onValueChange={showColumns}
      renderValue={() => copy.tableColumns}
      searchPlaceholder={copy.tableColumnsSearch}
      emptyLabel={copy.tableColumnsEmpty}
      header={{
        label: copy.tableColumnsShown,
        action: everythingShown
          ? { label: copy.tableColumnsHideAll, onAction: () => showColumns([]) }
          : { label: copy.tableColumnsShowAll, onAction: () => showColumns(TOGGLEABLE_LEADERBOARD_COLUMN_IDS) },
      }}
    />
  );
}
