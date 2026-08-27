import { useMemo, useState } from 'react';
import {
  EMPTY_INVENTORY_FILTER,
  filterInventoryView,
  isEmptyInventoryFilter,
  kindsInView,
  rarityIndicesInView,
  type InventoryEntry,
  type InventoryFilter,
  type InventoryGroup,
  type InventoryView,
  type InventoryViewItem,
  type InventoryViewStat,
  type ItemKind,
} from '@bombfarm/domain/inventory-view';
import { cn } from '@bombfarm/ui';
import { GoldIcon } from './gold-icon';
import { InventoryItemIcon } from './inventory-item-icon';
import { rarityTextClass } from './game-art.recipe';
import {
  inventoryBadgeRecipe,
  inventoryCardRecipe,
  inventoryCardTone,
  inventoryChipRecipe,
  inventoryCountClass,
  inventoryGridClass,
  type InventoryBadgeTone,
} from './inventory-grid.recipe';

export interface InventoryBadge {
  key: string;
  label: string;
  tone?: InventoryBadgeTone;
}

/** The hero an item sits on. Resolved by the caller — this package holds no roster. */
export interface InventoryEquippedBy {
  /** Localized hero name and level, e.g. "Kendo · Lv 157". Shown in the hero's rarity colour. */
  text: string;
  /** Hero rarity index; `-1` for a hero the caller could not resolve. */
  rarityIdx: number;
}

export interface InventoryToolbarLabels {
  searchPlaceholder: string;
  searchLabel: string;
  allKinds: string;
  rarity: (rarityIdx: number) => string;
  equippedOnly: string;
  clear: string;
  resultCount: (shown: number, total: number) => string;
  noMatches: string;
}

export interface InventoryGridLabels {
  groupTitle: (kind: ItemKind) => string;
  /** Display name for one item — the caller owns it, since set, slot and rarity tokens are
   *  localized and this package carries no i18n. */
  itemName: (item: InventoryViewItem) => string;
  /** Line under the name: rarity for everything, plus level and forge for gear. */
  itemDetail: (item: InventoryViewItem) => string;
  /** One stat line, already localized and formatted (label, sign, value, unit). */
  itemStat: (stat: InventoryViewStat) => string;
  badges: (item: InventoryViewItem) => InventoryBadge[];
  /** Footer left. `null` when the item is loose, or when the caller has no roster. */
  equippedBy?: (item: InventoryViewItem) => InventoryEquippedBy | null;
  /** Footer right, beside the gold coin. */
  gold: (amount: number) => string;
  /** What free-text search matches against for one item. */
  searchText: (item: InventoryViewItem) => string;
  toolbar: InventoryToolbarLabels;
  /** Rendered in the `other` group's header — the raw category codes it holds, so an
   *  unrecognized item type can be reported without re-reading a capture. */
  unknownCategoryNote?: (codes: readonly number[]) => string;
  skippedNote?: (count: number) => string;
  empty: { title: string; description?: string };
}

export interface InventoryGridProps {
  view: InventoryView;
  labels: InventoryGridLabels;
  onSelectItem?: (item: InventoryViewItem) => void;
  className?: string;
}

function unknownCategoryCodes(group: InventoryGroup): number[] {
  const codes = new Set<number>();
  for (const entry of group.entries) {
    if (entry.item.categoryCode !== null) codes.add(entry.item.categoryCode);
  }
  return [...codes].sort((a, b) => a - b);
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/** Four is what a Mítico rolls; showing all six of a future tier would push the footer around. */
const MAX_STAT_LINES = 4;

function InventoryCard({
  entry,
  labels,
  onSelect,
}: {
  entry: InventoryEntry;
  labels: InventoryGridLabels;
  onSelect?: (item: InventoryViewItem) => void;
}) {
  const { item, count } = entry;
  const detail = labels.itemDetail(item);
  const badges = labels.badges(item);
  const equippedBy = labels.equippedBy?.(item) ?? null;
  const stats = item.stats.slice(0, MAX_STAT_LINES);
  const tone = inventoryCardTone(item.rarityIdx, item.defResolved);
  const interactive = Boolean(onSelect);

  const body = (
    <>
      <span className="flex min-w-0 items-start gap-2.5">
        <InventoryItemIcon item={item} size="xl" className="shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-start gap-1.5">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm font-semibold',
                rarityTextClass(item.rarityIdx) ?? 'text-ink',
              )}
            >
              {labels.itemName(item)}
            </span>
            {count > 1 ? <span className={inventoryCountClass}>&times;{count}</span> : null}
          </span>
          {detail ? <span className="truncate text-xs text-muted">{detail}</span> : null}
          {stats.length > 0 ? (
            <span className="mt-0.5 flex flex-col gap-px">
              {stats.map((stat) => (
                <span key={stat.code} className="truncate text-xs tabular-nums text-muted">
                  {labels.itemStat(stat)}
                </span>
              ))}
            </span>
          ) : null}
          {badges.length > 0 ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span key={badge.key} className={inventoryBadgeRecipe({ tone: badge.tone })}>
                  {badge.label}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </span>
      {/* `mt-auto` is what pins this row to the bottom edge whatever sits above it, so a Comum
          carrying one stat and a Mítico carrying four still line their footers up across a row. */}
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-line/60 pt-2">
        <span
          className={cn(
            'min-w-0 truncate text-xs font-medium',
            equippedBy ? (rarityTextClass(equippedBy.rarityIdx) ?? 'text-ink') : 'text-muted',
          )}
        >
          {equippedBy ? equippedBy.text : ''}
        </span>
        {entry.sellValueGold > 0 ? (
          <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted">
            <GoldIcon className="size-3.5" />
            {labels.gold(entry.sellValueGold)}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!interactive) {
    return <div className={inventoryCardRecipe({ tone, interactive: false })}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={inventoryCardRecipe({ tone, interactive: true })}
      onClick={() => onSelect?.(item)}
    >
      {body}
    </button>
  );
}

function InventoryToolbar({
  view,
  labels,
  filter,
  onChange,
  shown,
}: {
  view: InventoryView;
  labels: InventoryGridLabels;
  filter: InventoryFilter;
  onChange: (next: InventoryFilter) => void;
  shown: number;
}) {
  const kinds = useMemo(() => kindsInView(view), [view]);
  const rarities = useMemo(() => rarityIndicesInView(view), [view]);
  const anyEquipped = useMemo(() => view.items.some((item) => item.equipped), [view]);
  const dirty = !isEmptyInventoryFilter(filter);

  return (
    <div className="flex flex-col gap-2 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filter.text}
          onChange={(event) => onChange({ ...filter, text: event.target.value })}
          placeholder={labels.toolbar.searchPlaceholder}
          aria-label={labels.toolbar.searchLabel}
          className="min-w-40 flex-1 rounded-md border border-line bg-bg-2 px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {labels.toolbar.resultCount(shown, view.items.length)}
        </span>
        {dirty ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_INVENTORY_FILTER)}
            className={inventoryChipRecipe({ active: false })}
          >
            {labels.toolbar.clear}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={filter.kinds.length === 0}
          onClick={() => onChange({ ...filter, kinds: [] })}
          className={inventoryChipRecipe({ active: filter.kinds.length === 0 })}
        >
          {labels.toolbar.allKinds}
        </button>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={filter.kinds.includes(kind)}
            onClick={() => onChange({ ...filter, kinds: toggle(filter.kinds, kind) })}
            className={inventoryChipRecipe({ active: filter.kinds.includes(kind) })}
          >
            {labels.groupTitle(kind)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {rarities.map((rarityIdx) => (
          <button
            key={rarityIdx}
            type="button"
            aria-pressed={filter.rarities.includes(rarityIdx)}
            onClick={() => onChange({ ...filter, rarities: toggle(filter.rarities, rarityIdx) })}
            className={cn(
              inventoryChipRecipe({ active: filter.rarities.includes(rarityIdx) }),
              !filter.rarities.includes(rarityIdx) && rarityTextClass(rarityIdx),
            )}
          >
            {labels.toolbar.rarity(rarityIdx)}
          </button>
        ))}
        {anyEquipped ? (
          <button
            type="button"
            aria-pressed={filter.equippedOnly}
            onClick={() => onChange({ ...filter, equippedOnly: !filter.equippedOnly })}
            className={inventoryChipRecipe({ active: filter.equippedOnly })}
          >
            {labels.toolbar.equippedOnly}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The inventory surface both shells render. Takes the domain's grouped view as-is and owns no
 * strings of its own — every label arrives through {@link InventoryGridLabels} so the web planner
 * and the desktop can each supply their own locale.
 */
export function InventoryGrid({ view, labels, onSelectItem, className }: InventoryGridProps) {
  const [filter, setFilter] = useState<InventoryFilter>(EMPTY_INVENTORY_FILTER);

  const filtered = useMemo(
    () => filterInventoryView(view, filter, labels.searchText),
    [view, filter, labels],
  );

  if (view.items.length === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
        <h2 className="text-base font-semibold text-ink">{labels.empty.title}</h2>
        {labels.empty.description ? (
          <p className="max-w-prose text-sm text-muted">{labels.empty.description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <InventoryToolbar
        view={view}
        labels={labels}
        filter={filter}
        onChange={setFilter}
        shown={filtered.items.length}
      />

      {filtered.items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted">{labels.toolbar.noMatches}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {filtered.groups.map((group) => {
            const codes = group.kind === 'other' ? unknownCategoryCodes(group) : [];
            const note = codes.length > 0 ? labels.unknownCategoryNote?.(codes) : undefined;

            return (
              <section key={group.kind} className="flex flex-col gap-2">
                <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-sm font-semibold text-ink">{labels.groupTitle(group.kind)}</h3>
                  <span className="text-xs tabular-nums text-muted">{group.count}</span>
                  {note ? <span className="text-xs text-muted">{note}</span> : null}
                </header>
                <div className={inventoryGridClass}>
                  {group.entries.map((entry) => (
                    <InventoryCard key={entry.key} entry={entry} labels={labels} onSelect={onSelectItem} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view.skipped > 0 && labels.skippedNote ? (
        <p className="pt-3 text-xs text-muted">{labels.skippedNote(view.skipped)}</p>
      ) : null}
    </div>
  );
}
