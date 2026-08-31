import { useMemo, type ReactNode } from "react";
import {
  INVENTORY_SORT_KEYS,
  EMPTY_INVENTORY_FILTER,
  isEmptyInventoryFilter,
  kindsInView,
  rarityIndicesInView,
  setsInView,
  heroIdsInView,
  sortDirectionFor,
  withSortTerm,
  DEFAULT_INVENTORY_SORT,
  type InventoryFilter,
  type InventorySetGroup,
  type InventorySort,
  type InventorySortKey,
  type InventoryView,
  type ItemKind,
} from "@bombfarm/domain/inventory-view";
import { cn, Icon, Select, SelectMultiple, Tooltip } from "@bombfarm/ui";
import { rarityTextClass } from "./game-art.recipe";
import {
  inventoryChipRecipe,
  inventoryFieldClass,
  inventoryHeroSelectClass,
  inventorySetSelectClass,
  inventorySortDirectionClass,
  inventorySortGroupClass,
  inventorySortSelectClass,
} from "./inventory-grid.recipe";

export const MAX_HERO_STARS = 3;

/**
 * A hero in the filter list. Carries the same pieces the card's footer draws, so the dropdown
 * reads as the same identity block rather than a bare name.
 */
export interface InventoryHeroOption {
  id: string;
  name: string;
  /** Rank letter (`A`, `S`, …); empty when the hero has none. */
  rank: string;
  rarityIdx: number;
  stars: number;
  /** Already-localized, e.g. "Lv 85". */
  level: string;
}

export interface InventoryToolbarLabels {
  searchPlaceholder: string;
  searchLabel: string;
  allKinds: string;
  rarity: (rarityIdx: number) => string;
  equippedOnly: string;
  /** Narrows to items the market is asking a price for right now. */
  pricedOnly: string;
  clear: string;
  resultCount: (shown: number, total: number) => string;
  noMatches: string;
  heroLabel: string;
  allHeroes: string;
  setsLabel: string;
  allSets: string;
  /** Caption over the set list inside the popup, e.g. "Sets you own". */
  setsOwned: string;
  /** Trigger text once the list is narrowed, e.g. "4 of 9 sets". */
  setsSelected: (chosen: number, total: number) => string;
  /** The popup's action when the list is narrowed — the other half of `clear`. */
  selectAllSets: string;
  sortLabel: string;
  sortKey: (key: InventorySortKey) => string;
  sortAscending: string;
  sortDescending: string;
}


/**
 * Everything the toolbar reads off its host's labels, and nothing else — so the card layout's bag
 * and the list layout's both satisfy it without either being the other's shape.
 */
export interface InventoryToolbarLabelBag {
  groupTitle: (kind: ItemKind) => string;
  heroOption?: ((heroId: string) => InventoryHeroOption) | undefined;
  setOption: (group: InventorySetGroup) => string;
  setOptionCount: (group: InventorySetGroup) => string;
  toolbar: InventoryToolbarLabels;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
}

function HeroOptionLabel({ hero }: { hero: InventoryHeroOption }) {
  const stars = Math.max(0, Math.min(MAX_HERO_STARS, Math.round(hero.stars)));
  return (
    <span className="flex min-w-0 items-baseline gap-1">
      {hero.rank ? (
        <span className="shrink-0 text-[11px] font-black tracking-tight text-accent">{hero.rank}</span>
      ) : null}
      <span className={cn('truncate font-semibold', rarityTextClass(hero.rarityIdx) ?? 'text-ink')}>
        {hero.name}
      </span>
      {stars > 0 ? (
        <span className="shrink-0 text-[10px] tracking-tight text-rar-4" aria-hidden>
          {'★'.repeat(stars)}
        </span>
      ) : null}
      {hero.level ? (
        <span className="shrink-0 text-[10px] tabular-nums text-muted">{hero.level}</span>
      ) : null}
    </span>
  );
}

export interface InventoryToolbarProps {
  view: InventoryView;
  labels: InventoryToolbarLabelBag;
  filter: InventoryFilter;
  onFilterChange: (next: InventoryFilter) => void;
  sort: InventorySort;
  onSortChange: (next: InventorySort) => void;
  shown: number;
  /** The list layout sorts through its own column headers, so it hides this pair rather than
   *  offering a second control for the same order. */
  showSort?: boolean;
  /** Offered only where a market snapshot exists — with no prices to compare, the chip would
   *  empty the screen and say nothing about why. */
  showPricedOnly?: boolean;
  /** Slot at the row's right edge — the layout toggle sits here, in the corner of the list it
   *  switches rather than above the panel's own heading. */
  actions?: ReactNode;
}

export function InventoryToolbar({
  view,
  labels,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  shown,
  showSort = true,
  showPricedOnly = false,
  actions,
}: InventoryToolbarProps) {
  const kinds = useMemo(() => kindsInView(view), [view]);
  const rarities = useMemo(() => rarityIndicesInView(view), [view]);
  const anyEquipped = useMemo(
    () => view.items.some((item) => item.equipped),
    [view]
  );
  const heroes = useMemo(() => {
    const resolve = labels.heroOption;
    if (!resolve) return [];
    return heroIdsInView(view)
      .map(resolve)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [view, labels]);
  const sets = useMemo(() => setsInView(view), [view]);
  const dirty = !isEmptyInventoryFilter(filter);

  // A `null` `sets` means every set, so the boxes start ticked. Ticking the last one collapses
  // back to `null` rather than listing all nine, which keeps the filter from reading as dirty
  // while it shows everything. Unticking the last one is the empty list, and stays that way.
  const allSetIds = useMemo(() => sets.map((group) => group.set), [sets]);
  const selectedSets = filter.sets ?? allSetIds;
  const setsAreNarrowed = filter.sets !== null;

  const primary = sort[0] ?? DEFAULT_INVENTORY_SORT[0];
  const ascending = primary.direction === "asc";
  const directionLabel = ascending
    ? labels.toolbar.sortAscending
    : labels.toolbar.sortDescending;

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <div className="flex flex-col gap-2 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort leads the row: it describes the whole grid, where the search box narrows it.
            Both halves share an outline so the pair reads as "sorted by X, descending", and the
            group matches the search box's height rather than sitting as a shorter pill beside it. */}
          {showSort ? (
          <span className={inventorySortGroupClass}>
            <Select
              size="compact"
              value={primary.key}
              onChange={(event) =>
                onSortChange(
                  withSortTerm(sort, {
                    key: event.target.value as InventorySortKey,
                    direction:
                      sortDirectionFor(
                        sort,
                        event.target.value as InventorySortKey
                      ) ?? "desc",
                  })
                )
              }
              aria-label={labels.toolbar.sortLabel}
              className={inventorySortSelectClass}
            >
              {INVENTORY_SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {labels.toolbar.sortKey(key)}
                </option>
              ))}
            </Select>
            {/* The design system tooltip, not the browser's `title`: a native one ignores the
              theme, waits ~1s, and cannot be dismissed with Escape. */}
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                onClick={() =>
                  onSortChange(
                    withSortTerm(sort, {
                      key: primary.key,
                      direction: ascending ? "desc" : "asc",
                    })
                  )
                }
                aria-label={directionLabel}
                className={inventorySortDirectionClass}
              >
                <Icon
                  name={ascending ? "sort-ascending" : "sort-descending"}
                  size="sm"
                />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0 text-xs text-ink">{directionLabel}</p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </span>
          ) : null}

          {/* A select rather than a chip per hero: a mature account fields dozens, and that many
              chips would push the grid below the fold before a single item was shown. It sits
              between the sort control and the search box because it narrows by WHO, a coarser cut
              than the free text to its right. */}
          {heroes.length > 0 ? (
            <Select
              size="compact"
              value={filter.heroIds[0] ?? ""}
              onChange={(event) =>
                onFilterChange({
                  ...filter,
                  heroIds: event.target.value ? [event.target.value] : [],
                })
              }
              aria-label={labels.toolbar.heroLabel}
              className={inventoryHeroSelectClass}
            >
              <option value="">{labels.toolbar.allHeroes}</option>
              {heroes.map((hero) => (
                <option key={hero.id} value={hero.id}>
                  <HeroOptionLabel hero={hero} />
                </option>
              ))}
            </Select>
          ) : null}

          {sets.length > 1 ? (
            <SelectMultiple
              size="compact"
              value={selectedSets}
              onValueChange={(next) =>
                onFilterChange({
                  ...filter,
                  sets: next.length === allSetIds.length ? null : next,
                })
              }
              aria-label={labels.toolbar.setsLabel}
              className={inventorySetSelectClass}
              renderValue={() =>
                filter.sets
                  ? labels.toolbar.setsSelected(filter.sets.length, allSetIds.length)
                  : labels.toolbar.allSets
              }
              header={{
                label: labels.toolbar.setsOwned,
                // One action, whichever of the two would move: everything ticked can only be
                // cleared, anything less can only be filled back in.
                action: setsAreNarrowed
                  ? {
                      label: labels.toolbar.selectAllSets,
                      onAction: () => onFilterChange({ ...filter, sets: null }),
                    }
                  : {
                      label: labels.toolbar.clear,
                      onAction: () => onFilterChange({ ...filter, sets: [] }),
                    },
              }}
              optionTrailing={(value) => {
                const group = sets.find((entry) => entry.set === value);
                return group ? labels.setOptionCount(group) : null;
              }}
            >
              {sets.map((group) => (
                <option key={group.set} value={group.set}>
                  {labels.setOption(group)}
                </option>
              ))}
            </SelectMultiple>
          ) : null}

          <input
            type="search"
            value={filter.text}
            onChange={(event) =>
              onFilterChange({ ...filter, text: event.target.value })
            }
            placeholder={labels.toolbar.searchPlaceholder}
            aria-label={labels.toolbar.searchLabel}
            className={cn(inventoryFieldClass, "min-w-40 flex-1")}
          />

          <span className="shrink-0 text-xs tabular-nums text-muted">
            {labels.toolbar.resultCount(shown, view.items.length)}
          </span>
          {dirty ? (
            <button
              type="button"
              onClick={() => onFilterChange(EMPTY_INVENTORY_FILTER)}
              className={inventoryChipRecipe({ active: false })}
            >
              {labels.toolbar.clear}
            </button>
          ) : null}
          {actions == null ? null : <span className="ml-auto flex items-center">{actions}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={filter.kinds.length === 0}
            onClick={() => onFilterChange({ ...filter, kinds: [] })}
            className={inventoryChipRecipe({
              active: filter.kinds.length === 0,
            })}
          >
            {labels.toolbar.allKinds}
          </button>
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={filter.kinds.includes(kind)}
              onClick={() =>
                onFilterChange({ ...filter, kinds: toggle(filter.kinds, kind) })
              }
              className={inventoryChipRecipe({
                active: filter.kinds.includes(kind),
              })}
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
              onClick={() =>
                onFilterChange({
                  ...filter,
                  rarities: toggle(filter.rarities, rarityIdx),
                })
              }
              className={cn(
                inventoryChipRecipe({
                  active: filter.rarities.includes(rarityIdx),
                }),
                !filter.rarities.includes(rarityIdx) &&
                  rarityTextClass(rarityIdx)
              )}
            >
              {labels.toolbar.rarity(rarityIdx)}
            </button>
          ))}
          {showPricedOnly ? (
            <button
              type="button"
              aria-pressed={filter.pricedOnly}
              onClick={() =>
                onFilterChange({ ...filter, pricedOnly: !filter.pricedOnly })
              }
              className={inventoryChipRecipe({ active: filter.pricedOnly })}
            >
              {labels.toolbar.pricedOnly}
            </button>
          ) : null}
          {anyEquipped ? (
            <button
              type="button"
              aria-pressed={filter.equippedOnly}
              onClick={() =>
                onFilterChange({
                  ...filter,
                  equippedOnly: !filter.equippedOnly,
                })
              }
              className={inventoryChipRecipe({ active: filter.equippedOnly })}
            >
              {labels.toolbar.equippedOnly}
            </button>
          ) : null}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
