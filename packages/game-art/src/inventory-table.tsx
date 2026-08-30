import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_INVENTORY_SORT,
  EMPTY_INVENTORY_FILTER,
  filterInventoryView,
  sortDirectionFor,
  sortInventoryView,
  withSortTerm,
  type InventoryEntry,
  type InventoryFilter,
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
import { ItemIcon } from './item-icon';
import { MarketPrice, type MarketPriceLabels, type MarketPriceView } from './market-price';
import { rarityTextClass } from './game-art.recipe';
import { inventoryChipRecipe } from './inventory-grid.recipe';
import type { InventoryEquippedBy } from './inventory-grid';
import {
  InventoryToolbar,
  type InventoryHeroOption,
  type InventoryToolbarLabels,
} from "./inventory-toolbar";
import {
  inventoryTableActionButtonClass,
  inventoryTableBlankClass,
  inventoryTableForgeClass,
  inventoryTableGoldClass,
  inventoryTableGroupCountClass,
  inventoryTableGroupHeaderClass,
  inventoryTableHeroClass,
  inventoryTableHeroNameClass,
  inventoryTableItemNameClass,
  inventoryTableNameClass,
  inventoryTableRowClass,
  inventoryTableSkippedNoteClass,
} from './inventory-table.recipe';

export interface InventoryTableColumnLabels {
  name: string;
  rarity: string;
  level: string;
  count: string;
  value: string;
  market: string;
  equippedBy: string;
  actions: string;
}

export interface InventoryTableLabels {
  /** The table's own accessible name, rendered as a visually hidden `<caption>`. */
  caption: string;
  groupTitle: (kind: ItemKind) => string;
  /** Display name for one item — the caller owns it, since set, slot and rarity tokens are
   *  localized and this package carries no i18n. */
  itemName: (item: InventoryViewItem) => string;
  /** Empty for the kinds whose NAME is already their tier (a key, a house part, a skill stone),
   *  which is also what tells the row to colour the name instead. */
  itemRarity: (item: InventoryViewItem) => string;
  /** The forge `+N`, or empty when the item is unforged. */
  itemForge: (item: InventoryViewItem) => string;
  /** `null` when the item is loose, or when the caller has no roster. Absent drops the column. */
  equippedBy?: (item: InventoryViewItem) => InventoryEquippedBy | null;
  gold: (amount: number) => string;
  /** What free-text search matches against for one item. */
  searchText: (item: InventoryViewItem) => string;
  column: InventoryTableColumnLabels;
  setOption: (group: InventorySetGroup) => string;
  setOptionCount: (group: InventorySetGroup) => string;
  heroOption?: (heroId: string) => InventoryHeroOption;
  toolbar: InventoryToolbarLabels;
  /** Accessible name for the row's own control. Takes the item name because these repeat down
   *  the page, and a column of identical "Details" buttons names nothing. */
  rowAction: (itemName: string) => string;
  clear: string;
  /** Shown in place of the rows when the filter is what emptied them. */
  filteredEmpty: { title: string; description: string };
  empty: { title: string; description?: string };
  skippedNote?: (count: number) => string;
}

export interface InventoryTableProps {
  view: InventoryView;
  labels: InventoryTableLabels;
  /** Omit to let the table own its filter; supply both to drive it from a shared toolbar. */
  filter?: InventoryFilter;
  onFilterChange?: (next: InventoryFilter) => void;
  sort?: InventorySort;
  onSortChange?: (next: InventorySort) => void;
  onSelectItem?: (item: InventoryViewItem) => void;
  /** `null` for an entry the market says nothing about. Absent drops the price column. */
  priceOf?: (entry: InventoryEntry) => MarketPriceView | null;
  priceLabels?: MarketPriceLabels;
  /** Whether the market is quoting a price for one item right now — the `Priced` chip's predicate.
   *  Supplied by the host, which owns the snapshot; absent drops the chip. */
  isPricedItem?: (item: InventoryViewItem) => boolean;
  /** Per-row refresh control, placed beside the price it refreshes. */
  renderPriceAction?: (entry: InventoryEntry) => ReactNode;
  className?: string;
}

/**
 * Numbers read best largest-first, names smallest-first — so a column's first click sorts the way
 * a reader expects it to without having to click twice.
 */
const ASCENDING_FIRST: ReadonlySet<InventorySortKey> = new Set<InventorySortKey>(['name']);

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
  id: string;
  label: string;
  align: ColumnAlign;
  /** `null` for the columns nothing can be ordered by. */
  sortKey: InventorySortKey | null;
};

function columnsFor(
  labels: InventoryTableLabels,
  withPrice: boolean,
  withHero: boolean,
  withActions: boolean,
): Column[] {
  const columns: Column[] = [
    { id: 'name', label: labels.column.name, align: 'left', sortKey: 'name' },
    { id: 'rarity', label: labels.column.rarity, align: 'left', sortKey: 'rarity' },
    { id: 'level', label: labels.column.level, align: 'right', sortKey: 'level' },
    { id: 'count', label: labels.column.count, align: 'right', sortKey: 'count' },
    { id: 'value', label: labels.column.value, align: 'right', sortKey: 'value' },
  ];
  if (withPrice) columns.push({ id: 'market', label: labels.column.market, align: 'right', sortKey: 'market' });
  if (withHero) columns.push({ id: 'hero', label: labels.column.equippedBy, align: 'left', sortKey: null });
  if (withActions) columns.push({ id: 'actions', label: labels.column.actions, align: 'right', sortKey: null });
  return columns;
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

/**
 * Memoised for the same reason the card is: `sortInventoryView` re-sorts a copy of each group's
 * array, so every `InventoryEntry` survives with its reference intact and a re-sort re-renders no
 * rows at all. That holds only while `labels`, `priceOf` and `renderPriceAction` are stable, which
 * is the host's side of the bargain.
 */
const InventoryTableRow = memo(function InventoryTableRow({
  entry,
  labels,
  withPrice,
  withHero,
  withActions,
  priceOf,
  priceLabels,
  renderPriceAction,
  onSelect,
}: {
  entry: InventoryEntry;
  labels: InventoryTableLabels;
  withPrice: boolean;
  withHero: boolean;
  withActions: boolean;
  priceOf?: (entry: InventoryEntry) => MarketPriceView | null;
  priceLabels?: MarketPriceLabels;
  renderPriceAction?: (entry: InventoryEntry) => ReactNode;
  onSelect?: (item: InventoryViewItem) => void;
}) {
  const { item, count } = entry;
  const name = labels.itemName(item);
  const rarity = labels.itemRarity(item);
  const forge = labels.itemForge(item);
  const hero = labels.equippedBy?.(item) ?? null;
  const price = priceOf?.(entry) ?? null;

  return (
    <DataTable.Row data-testid="inventory-table-row" data-item-id={entry.key} className={inventoryTableRowClass}>
      <DataTable.RowHeader>
        <span className={inventoryTableNameClass}>
          <ItemIcon item={item} size="sm" showLevel={false} showUpgrade={false} />
          <span className="flex min-w-0 items-baseline">
            <span className={cn(inventoryTableItemNameClass, rarity ? 'text-ink' : rarityTextClass(item.rarityIdx) ?? 'text-ink')}>
              {name}
            </span>
            {forge ? <span className={inventoryTableForgeClass}>{forge}</span> : null}
          </span>
        </span>
      </DataTable.RowHeader>

      <DataTable.Cell className={cn('font-medium', rarityTextClass(item.rarityIdx))}>
        {rarity || <Blank />}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {item.level > 0 ? item.level : <Blank />}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {count}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {entry.sellValueGold > 0 ? (
          <span className={inventoryTableGoldClass}>
            <GoldIcon className="size-3.5" />
            {labels.gold(entry.sellValueGold)}
          </span>
        ) : (
          <Blank />
        )}
      </DataTable.Cell>

      {withPrice ? (
        <DataTable.Cell align="right" numeric>
          {price && priceLabels ? (
            <MarketPrice price={price} labels={priceLabels} action={renderPriceAction?.(entry)} />
          ) : (
            <Blank />
          )}
        </DataTable.Cell>
      ) : null}

      {withHero ? <DataTable.Cell>{hero ? <EquippedByCell hero={hero} /> : <Blank />}</DataTable.Cell> : null}

      {withActions ? (
        <DataTable.Cell align="right">
          <button
            type="button"
            aria-label={labels.rowAction(name)}
            className={inventoryTableActionButtonClass}
            onClick={() => onSelect?.(item)}
          >
            <Icon name="information-circle" size="sm" />
          </button>
        </DataTable.Cell>
      ) : null}
    </DataTable.Row>
  );
});

/**
 * The inventory as a list: the same view, filter and sort model the card grid renders, laid out so
 * one column of numbers can be read down the page. Owns no strings of its own — every label
 * arrives through {@link InventoryTableLabels}, as it does for the grid.
 */
export function InventoryTable({
  view,
  labels,
  filter: filterProp,
  onFilterChange,
  sort: sortProp,
  onSortChange,
  onSelectItem,
  priceOf,
  priceLabels,
  isPricedItem,
  renderPriceAction,
  className,
}: InventoryTableProps) {
  const [ownFilter, setOwnFilter] = useState<InventoryFilter>(EMPTY_INVENTORY_FILTER);
  const [ownSort, setOwnSort] = useState<InventorySort>(DEFAULT_INVENTORY_SORT);

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

  const columns = columnsFor(labels, withPrice, withHero, withActions);
  const leading = sort[0] ?? DEFAULT_INVENTORY_SORT[0];

  if (view.items.length === 0) {
    return <EmptyState title={labels.empty.title} description={labels.empty.description} className={className} />;
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* The same toolbar the cards use, minus the sort pair: this layout sorts through its own
          column headers, and two controls for one order is one too many. */}
      <InventoryToolbar
        view={view}
        labels={labels}
        filter={filter}
        onFilterChange={changeFilter}
        sort={sort}
        onSortChange={changeSort}
        shown={sorted.items.length}
        showSort={false}
        showPricedOnly={isPricedItem != null}
      />

      {sorted.items.length === 0 ? (
        <EmptyState
          title={labels.filteredEmpty.title}
          description={labels.filteredEmpty.description}
          action={
            <button
              type="button"
              onClick={() => changeFilter(EMPTY_INVENTORY_FILTER)}
              className={inventoryChipRecipe({ active: false })}
            >
              {labels.clear}
            </button>
          }
        />
      ) : (
        <DataTable.Root scrollable>
          <DataTable.Table>
            <DataTable.Caption>{labels.caption}</DataTable.Caption>
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
                      onSort={(key) => changeSort(nextInventorySort(sort, key))}
                      align={column.align}
                    >
                      {column.label}
                    </DataTable.Header>
                  ),
                )}
              </DataTable.Row>
            </DataTable.Head>

            {sorted.groups.map((group) => (
              <DataTable.Body key={group.kind} data-testid="inventory-table-group" data-kind={group.kind}>
                <DataTable.Row>
                  <th scope="colgroup" colSpan={columns.length} className={inventoryTableGroupHeaderClass}>
                    {labels.groupTitle(group.kind)}
                    <span className={inventoryTableGroupCountClass}>{group.count}</span>
                  </th>
                </DataTable.Row>
                {group.entries.map((entry) => (
                  <InventoryTableRow
                    key={entry.key}
                    entry={entry}
                    labels={labels}
                    withPrice={withPrice}
                    withHero={withHero}
                    withActions={withActions}
                    priceOf={priceOf}
                    priceLabels={priceLabels}
                    renderPriceAction={renderPriceAction}
                    onSelect={onSelectItem}
                  />
                ))}
              </DataTable.Body>
            ))}
          </DataTable.Table>
        </DataTable.Root>
      )}

      {view.skipped > 0 && labels.skippedNote ? (
        <p className={inventoryTableSkippedNoteClass}>{labels.skippedNote(view.skipped)}</p>
      ) : null}
    </div>
  );
}
