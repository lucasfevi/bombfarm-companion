import { memo, useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from 'react';
import {
  DEFAULT_INVENTORY_SORT,
  EMPTY_INVENTORY_FILTER,
  filterInventoryView,
  sortDirectionFor,
  sortInventoryView,
  withSortTerm,
  type InventoryEntry,
  type InventoryFilter,
  type InventoryGroup,
  type InventorySetGroup,
  type InventorySort,
  type InventorySortKey,
  type InventoryView,
  type InventoryViewItem,
  type ItemKind,
} from '@bombfarm/domain/inventory-view';
import { cn, DataTable, EmptyState, Icon } from '@bombfarm/ui';
import { GoldIcon } from './gold-icon';
import { HeroAvatar } from './hero-avatar';
import { ItemIdentity, type ItemIdentityLabels } from './item-identity';
import { MarketPrice, type MarketPriceLabels, type MarketPriceView } from './market-price';
import { rarityTextClass } from './game-art.recipe';
import { inventoryChipRecipe } from './inventory-grid.recipe';
import type { InventoryEquippedBy } from './inventory-grid';
import { rowOffsets, windowFor, type TableRowKind } from './inventory-table-window';
import {
  InventoryToolbar,
  type InventoryHeroOption,
  type InventoryToolbarLabels,
} from "./inventory-toolbar";
import {
  inventoryTableActionButtonClass,
  inventoryTableBlankClass,
  inventoryTableGoldClass,
  inventoryTableGroupCountClass,
  inventoryTableGroupHeaderClass,
  inventoryTableHeroClass,
  inventoryTableHeroNameClass,
  inventoryTableRowClass,
  inventoryTableSelectedRowClass,
  inventoryTableSkippedNoteClass,
} from './inventory-table.recipe';

/**
 * Every column the table knows how to draw. A host picks from these by id rather than handing
 * over a column array of its own: the set is what differs between an inventory bag and the Forge
 * bag, while how each column renders, aligns and sorts stays the table's.
 */
export type InventoryTableColumnId =
  | 'name'
  | 'slot'
  | 'forge'
  | 'count'
  | 'value'
  | 'market'
  | 'hero'
  | 'actions';

/** A whole inventory: what an item is, how many, what it fetches, and who is wearing it. Rarity
 *  and level are not here — the name cell says both, and printing them twice cost the row its
 *  height for nothing. */
export const DEFAULT_INVENTORY_TABLE_COLUMNS: readonly InventoryTableColumnId[] = [
  'name',
  'count',
  'value',
  'market',
  'hero',
  'actions',
];

export type InventoryTableColumnLabels = Record<InventoryTableColumnId, string>;

export interface InventoryTableLabels extends ItemIdentityLabels<InventoryViewItem> {
  /** The table's own accessible name, rendered as a visually hidden `<caption>`. */
  caption: string;
  groupTitle: (kind: ItemKind) => string;
  /** `null` when the item is loose, or when the caller has no roster. Absent drops the column. */
  equippedBy?: ((item: InventoryViewItem) => InventoryEquippedBy | null) | undefined;
  gold: (amount: number) => string;
  /** The gear slot, already localized. Required by a host that asks for the slot column. */
  slotName?: ((item: InventoryViewItem) => string) | undefined;
  /** What free-text search matches against for one item. */
  searchText: (item: InventoryViewItem) => string;
  column: InventoryTableColumnLabels;
  setOption: (group: InventorySetGroup) => string;
  setOptionCount: (group: InventorySetGroup) => string;
  heroOption?: ((heroId: string) => InventoryHeroOption) | undefined;
  toolbar: InventoryToolbarLabels;
  /** Accessible name for the row's own control. Takes the item name because these repeat down
   *  the page, and a column of identical "Details" buttons names nothing. */
  rowAction: (itemName: string) => string;
  clear: string;
  /** Shown in place of the rows when the filter is what emptied them. The way out is the button
   *  under it, so a description is only worth having when it says something the title does not. */
  filteredEmpty: { title: string; description?: string | undefined };
  empty: { title: string; description?: string | undefined };
  skippedNote?: ((count: number) => string) | undefined;
}

export interface InventoryTableProps {
  view: InventoryView;
  labels: InventoryTableLabels;
  /** Which columns this host wants, in the order it wants them. Defaults to
   *  {@link DEFAULT_INVENTORY_TABLE_COLUMNS}; a column the host cannot supply data for is
   *  dropped whether or not it was asked for. */
  columns?: readonly InventoryTableColumnId[] | undefined;
  /** Omit to let the table own its filter; supply both to drive it from a shared toolbar. */
  filter?: InventoryFilter;
  onFilterChange?: (next: InventoryFilter) => void;
  sort?: InventorySort;
  onSortChange?: (next: InventorySort) => void;
  onSelectItem?: ((item: InventoryViewItem) => void) | undefined;
  /** Makes the whole row a control, for a screen where picking a piece is the point. */
  onSelectRow?: ((item: InventoryViewItem) => void) | undefined;
  /** The piece {@link onSelectRow} last picked, marked in the list. */
  selectedItemId?: string | null | undefined;
  /** `null` for an entry the market says nothing about. Absent drops the price column. */
  priceOf?: ((entry: InventoryEntry) => MarketPriceView | null) | undefined;
  priceLabels?: MarketPriceLabels | undefined;
  /** Whether the market is quoting a price for one item right now — the `Priced` chip's predicate.
   *  Supplied by the host, which owns the snapshot; absent drops the chip. */
  isPricedItem?: ((item: InventoryViewItem) => boolean) | undefined;
  /** Off for a host that narrows the view itself through a toolbar of its own. */
  showToolbar?: boolean | undefined;
  /** Supplied by a host that filtered the view before handing it over, so an empty list can say
   *  the filter emptied it and offer the same way out the table's own filter has. */
  onClearFilter?: (() => void) | undefined;
  /** Slot at the toolbar's right edge, in the corner of the list itself. */
  toolbarActions?: ReactNode;
  /** Per-row refresh control, placed beside the price it refreshes. */
  renderPriceAction?: ((entry: InventoryEntry) => ReactNode) | undefined;
  className?: string | undefined;
}

/**
 * Numbers read best largest-first, names smallest-first — so a column's first click sorts the way
 * a reader expects it to without having to click twice.
 */
const ASCENDING_FIRST: ReadonlySet<InventorySortKey> = new Set<InventorySortKey>(['name', 'slot']);

/**
 * What activating a column header does. Re-picking the column that already leads flips it;
 * picking any other folds it in front, keeping the previous lead as the tie-break underneath —
 * which is what makes "level, then rarity" mean *rarity, ties broken by level*.
 */
export function nextInventorySort(sort: InventorySort, key: InventorySortKey): InventorySort {
  const leading = sort[0];
  if (leading && leading.key === key) {
    return withSortTerm(sort, { key, direction: leading.direction === 'asc' ? 'desc' : 'asc' });
  }
  return withSortTerm(sort, {
    key,
    direction: sortDirectionFor(sort, key) ?? (ASCENDING_FIRST.has(key) ? 'asc' : 'desc'),
  });
}

type ColumnAlign = 'left' | 'right';

type Column = {
  id: InventoryTableColumnId;
  label: string;
  align: ColumnAlign;
  /** `null` for the columns nothing can be ordered by. */
  sortKey: InventorySortKey | null;
  width: string | undefined;
};

/**
 * Each column's alignment, what it sorts by, and how wide it stands. The width matters because
 * the table is windowed: with an auto layout the browser measures whichever slice of rows happens
 * to be mounted, so the columns shift under the reader as they scroll. A fixed layout with these
 * widths measures nothing, and `undefined` — the item name — takes whatever is left over.
 */
const COLUMN_SHAPE: Record<
  InventoryTableColumnId,
  { align: ColumnAlign; sortKey: InventorySortKey | null; width: string | undefined }
> = {
  name: { align: 'left', sortKey: 'name', width: undefined },
  slot: { align: 'left', sortKey: 'slot', width: '8rem' },
  forge: { align: 'right', sortKey: 'forge', width: '5.5rem' },
  count: { align: 'right', sortKey: 'count', width: '5rem' },
  value: { align: 'right', sortKey: 'value', width: '8rem' },
  market: { align: 'right', sortKey: 'market', width: '11rem' },
  hero: { align: 'left', sortKey: null, width: '13rem' },
  actions: { align: 'right', sortKey: null, width: '3.5rem' },
};

function columnsFor(
  wanted: readonly InventoryTableColumnId[],
  labels: InventoryTableLabels,
  withPrice: boolean,
  withHero: boolean,
  withActions: boolean,
): Column[] {
  const available = (id: InventoryTableColumnId): boolean => {
    if (id === 'market') return withPrice;
    if (id === 'hero') return withHero;
    if (id === 'actions') return withActions;
    return true;
  };

  return wanted
    .filter(available)
    .map((id) => ({ id, label: labels.column[id], ...COLUMN_SHAPE[id] }));
}

const MAX_HERO_STARS = 3;

function EquippedByCell({ hero }: { hero: InventoryEquippedBy }) {
  if (hero.unknown) {
    return <span className={cn('truncate', inventoryTableBlankClass)}>{hero.name}</span>;
  }

  const stars = Math.max(0, Math.min(MAX_HERO_STARS, Math.round(hero.stars)));

  return (
    <span className={inventoryTableHeroClass}>
      <HeroAvatar skin={hero.skin} rarityIdx={hero.rarityIdx} size="xs" name={hero.name} className="shrink-0" />
      <span className={cn(inventoryTableHeroNameClass, rarityTextClass(hero.rarityIdx) ?? 'text-ink')}>
        {hero.name}
      </span>
      {stars > 0 ? (
        <span className="shrink-0 text-[10px] tracking-tight text-rar-4" aria-hidden>
          {'★'.repeat(stars)}
        </span>
      ) : null}
      {hero.level ? <span className="shrink-0 text-[10px] tabular-nums text-muted">{hero.level}</span> : null}
    </span>
  );
}

function Blank() {
  return <span className={inventoryTableBlankClass}>&mdash;</span>;
}

/** A single `<tr>` standing in for the height of the rows the window skipped, so the scrollbar
 *  and the scroll position stay right without those rows mounted. Padding and border are zeroed
 *  because the base `td` rule adds both. */
function SpacerRow({ testId, height, colSpan }: { testId: string; height: number; colSpan: number }) {
  return (
    <tr aria-hidden="true" data-testid={testId}>
      <td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}

function NameCell({
  item,
  labels,
  onSelect,
}: {
  item: InventoryViewItem;
  labels: InventoryTableLabels;
  onSelect: ((item: InventoryViewItem) => void) | undefined;
}) {
  const identity = (
    <span className="flex min-w-0 items-center gap-1">
      <ItemIdentity item={item} labels={labels} nameTestId="inventory-row-name" className="flex-1" />
      {item.locked ? <Icon name="lock-closed" size="xs" className="shrink-0 text-muted" /> : null}
    </span>
  );

  if (!onSelect) return identity;

  return (
    <button
      type="button"
      aria-label={labels.rowAction(labels.itemName(item))}
      className="w-full cursor-pointer border-0 bg-transparent p-0 text-left text-inherit"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item);
      }}
    >
      {identity}
    </button>
  );
}

/**
 * Memoised for the same reason the card is: `sortInventoryView` re-sorts a copy of each group's
 * array, so every `InventoryEntry` survives with its reference intact and a re-sort re-renders no
 * rows at all. That holds only while `labels`, `columns`, `priceOf` and `renderPriceAction` are
 * stable, which is the host's side of the bargain.
 */
const InventoryTableRow = memo(function InventoryTableRow({
  entry,
  labels,
  columns,
  rowIndex,
  selected,
  priceOf,
  priceLabels,
  renderPriceAction,
  onSelectItem,
  onSelectRow,
}: {
  entry: InventoryEntry;
  labels: InventoryTableLabels;
  columns: readonly Column[];
  rowIndex: number;
  selected: boolean;
  priceOf?: ((entry: InventoryEntry) => MarketPriceView | null) | undefined;
  priceLabels?: MarketPriceLabels | undefined;
  renderPriceAction?: ((entry: InventoryEntry) => ReactNode) | undefined;
  onSelectItem?: ((item: InventoryViewItem) => void) | undefined;
  onSelectRow?: ((item: InventoryViewItem) => void) | undefined;
}) {
  const { item, count } = entry;
  const hero = labels.equippedBy?.(item) ?? null;
  const price = priceOf?.(entry) ?? null;

  function cell(column: Column): ReactNode {
    switch (column.id) {
      case 'name':
        return (
          <DataTable.RowHeader key={column.id}>
            <NameCell item={item} labels={labels} onSelect={onSelectRow} />
          </DataTable.RowHeader>
        );
      case 'slot':
        return (
          <DataTable.Cell key={column.id} nowrap>
            {labels.slotName?.(item) || <Blank />}
          </DataTable.Cell>
        );
      case 'forge':
        return (
          <DataTable.Cell key={column.id} align="right" numeric className="font-semibold text-accent">
            {labels.itemForge(item) || <Blank />}
          </DataTable.Cell>
        );
      case 'count':
        return (
          <DataTable.Cell key={column.id} align="right" numeric>
            {count}
          </DataTable.Cell>
        );
      case 'value':
        return (
          <DataTable.Cell key={column.id} align="right" numeric>
            {entry.sellValueGold > 0 ? (
              <span className={inventoryTableGoldClass}>
                <GoldIcon className="size-3.5" />
                {labels.gold(entry.sellValueGold)}
              </span>
            ) : (
              <Blank />
            )}
          </DataTable.Cell>
        );
      case 'market':
        return (
          <DataTable.Cell key={column.id} align="right" numeric>
            {price && priceLabels ? (
              <MarketPrice price={price} labels={priceLabels} action={renderPriceAction?.(entry)} />
            ) : (
              <Blank />
            )}
          </DataTable.Cell>
        );
      case 'hero':
        return <DataTable.Cell key={column.id}>{hero ? <EquippedByCell hero={hero} /> : <Blank />}</DataTable.Cell>;
      case 'actions':
        return (
          <DataTable.Cell key={column.id} align="right">
            <button
              type="button"
              aria-label={labels.rowAction(labels.itemName(item))}
              className={inventoryTableActionButtonClass}
              onClick={() => onSelectItem?.(item)}
            >
              <Icon name="information-circle" size="sm" />
            </button>
          </DataTable.Cell>
        );
    }
  }

  return (
    <DataTable.Row
      data-testid="inventory-table-row"
      data-row-kind="entry"
      data-item-id={entry.key}
      data-selected={selected ? '' : undefined}
      aria-rowindex={rowIndex}
      aria-selected={onSelectRow ? selected : undefined}
      className={cn(inventoryTableRowClass, onSelectRow && 'cursor-pointer', selected && inventoryTableSelectedRowClass)}
      onClick={onSelectRow ? () => { onSelectRow(item); } : undefined}
    >
      {columns.map(cell)}
    </DataTable.Row>
  );
});

type FlatRow =
  | { kind: 'group'; key: string; group: InventoryGroup }
  | { kind: 'entry'; key: string; entry: InventoryEntry };

/** The guesses a first paint runs on, replaced by measurement once the body is in the document.
 *  `entry` matches the row's own `contain-intrinsic-size`. */
const INITIAL_METRICS = { entry: 46, group: 26, viewport: 640 };

/**
 * The inventory as a list: the same view, filter and sort model the card grid renders, laid out so
 * one column of numbers can be read down the page. Owns no strings of its own — every label
 * arrives through {@link InventoryTableLabels}, as it does for the grid.
 *
 * Only the rows a reader can see plus a band of overscan are in the document; the rest are two
 * spacer rows holding their height open. A mature bag is hundreds of gear rows, and the screens
 * around this table are bounded, so mounting all of them buys nothing a scroll cannot ask for.
 */
export function InventoryTable({
  view,
  labels,
  columns: wantedColumns = DEFAULT_INVENTORY_TABLE_COLUMNS,
  filter: filterProp,
  onFilterChange,
  sort: sortProp,
  onSortChange,
  onSelectItem,
  onSelectRow,
  selectedItemId = null,
  priceOf,
  priceLabels,
  isPricedItem,
  showToolbar = true,
  onClearFilter,
  toolbarActions,
  renderPriceAction,
  className,
}: InventoryTableProps) {
  const [ownFilter, setOwnFilter] = useState<InventoryFilter>(EMPTY_INVENTORY_FILTER);
  const [ownSort, setOwnSort] = useState<InventorySort>(DEFAULT_INVENTORY_SORT);
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const filter = filterProp ?? ownFilter;
  const sort = sortProp ?? ownSort;

  const changeFilter = (next: InventoryFilter) => {
    onFilterChange?.(next);
    if (filterProp === undefined) setOwnFilter(next);
  };
  const changeSort = (next: InventorySort) => {
    onSortChange?.(next);
    if (sortProp === undefined) setOwnSort(next);
  };

  const withPrice = priceOf !== undefined && priceLabels !== undefined;
  const withHero = labels.equippedBy !== undefined;
  const withActions = onSelectItem !== undefined;

  const marketValueOf = useMemo(() => {
    if (!priceOf) return undefined;
    return (entry: InventoryEntry) => {
      const price = priceOf(entry);
      return price !== null && price.state === 'priced' ? price.amount : null;
    };
  }, [priceOf]);

  const filtered = useMemo(
    () => filterInventoryView(view, filter, labels.searchText, isPricedItem),
    [view, filter, labels, isPricedItem],
  );
  const sorted = useMemo(
    () => sortInventoryView(filtered, sort, labels.itemName, marketValueOf),
    [filtered, sort, labels, marketValueOf],
  );

  const columns = useMemo(
    () => columnsFor(wantedColumns, labels, withPrice, withHero, withActions),
    [wantedColumns, labels, withPrice, withHero, withActions],
  );
  const leading = sort[0] ?? DEFAULT_INVENTORY_SORT[0];

  // A heading over the only group names nothing that the table's own caption does not.
  const withGroupHeadings = sorted.groups.length > 1;
  const rows = useMemo<FlatRow[]>(() => {
    const flat: FlatRow[] = [];
    for (const group of sorted.groups) {
      if (withGroupHeadings) flat.push({ kind: 'group', key: `group:${group.kind}`, group });
      for (const entry of group.entries) flat.push({ kind: 'entry', key: entry.key, entry });
    }
    return flat;
  }, [sorted, withGroupHeadings]);

  const offsets = useMemo(
    () => rowOffsets(rows.map((row): TableRowKind => row.kind), { entry: metrics.entry, group: metrics.group }),
    [rows, metrics.entry, metrics.group],
  );
  const { start, end } = useMemo(
    () => windowFor(offsets, scrollTop, metrics.viewport),
    [offsets, scrollTop, metrics.viewport],
  );

  const rowCount = rows.length;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;

    const read = () => {
      const entryRow = scroller.querySelector<HTMLElement>('[data-row-kind="entry"]');
      const groupRow = scroller.querySelector<HTMLElement>('[data-row-kind="group"]');
      setMetrics((current) => {
        const next = {
          entry: entryRow?.offsetHeight || current.entry,
          group: groupRow?.offsetHeight || current.group,
          viewport: scroller.clientHeight || current.viewport,
        };
        const same =
          next.entry === current.entry && next.group === current.group && next.viewport === current.viewport;
        return same ? current : next;
      });
    };

    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(scroller);
    return () => {
      observer.disconnect();
    };
  }, [rowCount]);

  if (view.items.length === 0 && onClearFilter === undefined) {
    return <EmptyState title={labels.empty.title} description={labels.empty.description} className={className} />;
  }

  const emptied = rowCount === 0;
  const clearFilter = onClearFilter ?? (() => { changeFilter(EMPTY_INVENTORY_FILTER); });
  const bodyHeight = offsets[rowCount] ?? 0;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* The same toolbar the cards use, sort control and all: rarity and level are no longer
          columns to click, and the picker is where a reader reaches an order the headers do not
          offer. */}
      {showToolbar ? (
        <InventoryToolbar
          view={view}
          labels={labels}
          filter={filter}
          onFilterChange={changeFilter}
          sort={sort}
          onSortChange={changeSort}
          shown={sorted.items.length}
          showPricedOnly={isPricedItem != null}
          actions={toolbarActions}
        />
      ) : null}

      {emptied ? (
        <EmptyState
          title={labels.filteredEmpty.title}
          description={labels.filteredEmpty.description}
          action={
            <button type="button" onClick={clearFilter} className={inventoryChipRecipe({ active: false })}>
              {labels.clear}
            </button>
          }
        />
      ) : (
        <DataTable.Root
          scrollable
          className="min-h-0 flex-1"
          ref={scrollerRef}
          onScroll={(event: UIEvent<HTMLDivElement>) => { setScrollTop(event.currentTarget.scrollTop); }}
          data-testid="inventory-table-scroll"
        >
          <DataTable.Table aria-rowcount={rowCount} className="table-fixed">
            <DataTable.Caption>{labels.caption}</DataTable.Caption>
            <colgroup>
              {columns.map((column) => (
                <col key={column.id} data-column={column.id} style={column.width ? { width: column.width } : undefined} />
              ))}
            </colgroup>
            <DataTable.Head>
              <DataTable.Row>
                {columns.map((column) =>
                  column.sortKey === null ? (
                    <DataTable.Header key={column.id} scope="col" align={column.align}>
                      {column.label}
                    </DataTable.Header>
                  ) : (
                    <DataTable.Header
                      key={column.id}
                      scope="col"
                      sortable
                      col={column.sortKey}
                      sortKey={leading.key}
                      sortDir={leading.direction}
                      onSort={(key) => { changeSort(nextInventorySort(sort, key)); }}
                      align={column.align}
                    >
                      {column.label}
                    </DataTable.Header>
                  ),
                )}
              </DataTable.Row>
            </DataTable.Head>

            <DataTable.Body>
              {start > 0 ? (
                <SpacerRow testId="inventory-table-spacer-top" height={offsets[start] ?? 0} colSpan={columns.length} />
              ) : null}
              {rows.slice(start, end).map((row, index) =>
                row.kind === 'group' ? (
                  <DataTable.Row
                    key={row.key}
                    data-row-kind="group"
                    data-testid="inventory-table-group"
                    data-kind={row.group.kind}
                    aria-rowindex={start + index + 1}
                  >
                    <th scope="colgroup" colSpan={columns.length} className={inventoryTableGroupHeaderClass}>
                      {labels.groupTitle(row.group.kind)}
                      <span className={inventoryTableGroupCountClass}>{row.group.count}</span>
                    </th>
                  </DataTable.Row>
                ) : (
                  <InventoryTableRow
                    key={row.key}
                    entry={row.entry}
                    labels={labels}
                    columns={columns}
                    rowIndex={start + index + 1}
                    selected={row.entry.item.id === selectedItemId}
                    priceOf={priceOf}
                    priceLabels={priceLabels}
                    renderPriceAction={renderPriceAction}
                    onSelectItem={onSelectItem}
                    onSelectRow={onSelectRow}
                  />
                ),
              )}
              {end < rowCount ? (
                <SpacerRow
                  testId="inventory-table-spacer-bottom"
                  height={bodyHeight - (offsets[end] ?? bodyHeight)}
                  colSpan={columns.length}
                />
              ) : null}
            </DataTable.Body>
          </DataTable.Table>
        </DataTable.Root>
      )}

      {view.skipped > 0 && labels.skippedNote ? (
        <p className={inventoryTableSkippedNoteClass}>{labels.skippedNote(view.skipped)}</p>
      ) : null}
    </div>
  );
}
