import { memo, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_INVENTORY_SORT,
  EMPTY_INVENTORY_FILTER,
  INVENTORY_SORT_KEYS,
  filterInventoryView,
  heroIdsInView,
  isEmptyInventoryFilter,
  kindsInView,
  rarityIndicesInView,
  setsInView,
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
  type InventoryViewStat,
  type ItemKind,
} from "@bombfarm/domain/inventory-view";
import { cn, Icon, Select, SelectMultiple, Tooltip } from "@bombfarm/ui";
import { GoldIcon } from "./gold-icon";
import { MarketPrice, type MarketPriceLabels, type MarketPriceView } from "./market-price";
import { HeroAvatar } from "./hero-avatar";
import { ItemIcon } from "./item-icon";
import { rarityTextClass } from "./game-art.recipe";
import {
  inventoryBadgeRecipe,
  inventoryCardRecipe,
  inventoryCardTone,
  inventoryChipRecipe,
  inventoryCountClass,
  inventoryCountValueClass,
  inventoryFieldClass,
  inventoryFooterClass,
  inventoryGridClass,
  inventoryHeroSelectClass,
  inventorySetSelectClass,
  inventorySortDirectionClass,
  inventorySortGroupClass,
  inventorySortSelectClass,
  inventoryStatLabelClass,
  inventoryStatLeaderClass,
  inventoryStatRowClass,
  inventoryStatValueClass,
  inventoryStatsPanelClass,
  type InventoryBadgeTone,
} from "./inventory-grid.recipe";

export interface InventoryBadge {
  key: string;
  label: string;
  tone?: InventoryBadgeTone;
}

/**
 * The hero an item sits on, as the pieces the card draws rather than a sentence — the footer
 * shows the avatar, the rank letter, the name in the hero's rarity colour and the level, which is
 * the roster's own identity block squeezed onto one line.
 */
export interface InventoryEquippedBy {
  name: string;
  /** Rank letter (`A`, `S`, …); empty when the hero has none. */
  rank: string;
  /** `-1` for a hero the caller could not resolve, which reads as no colour. */
  rarityIdx: number;
  /** Already-localized, e.g. "Lv 127". Empty when the level is not known. */
  level: string;
  /** Gems-to-stars ritual, 0..3. */
  stars: number;
  skin: number;
  /** The caller has no record of this hero — draw the name as a note, with no avatar. */
  unknown: boolean;
}

/** One stat, split so the card can put the label and the number at opposite edges. */
export interface InventoryStatText {
  label: string;
  /** Signed and unit-suffixed, e.g. "+5.51%" or "+90.2". */
  value: string;
}

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

export interface InventoryGridLabels {
  groupTitle: (kind: ItemKind) => string;
  /** Display name for one item — the caller owns it, since set, slot and rarity tokens are
   *  localized and this package carries no i18n. */
  itemName: (item: InventoryViewItem) => string;
  /**
   * The three parts of the line under the name, kept apart so the card can colour each: the
   * rarity in its own tier colour, the level muted, the forge in the accent. Joining them into
   * one string would force the card to colour the separators too.
   *
   * `rarity` is empty for the kinds whose NAME is already their tier (a key, a house part, a
   * skill stone) — that absence is also what tells the card to colour the name instead.
   */
  itemRarity: (item: InventoryViewItem) => string;
  itemLevel: (item: InventoryViewItem) => string;
  /** The forge `+N`, or empty when the item is unforged. */
  itemForge: (item: InventoryViewItem) => string;
  itemStat: (stat: InventoryViewStat) => InventoryStatText;
  badges: (item: InventoryViewItem) => InventoryBadge[];
  /** Footer left. `null` when the item is loose, or when the caller has no roster. */
  equippedBy?: (item: InventoryViewItem) => InventoryEquippedBy | null;
  /** Names the hero filter's options; a caller with no roster returns the id. */
  heroOption?: (heroId: string) => InventoryHeroOption;
  /** One set-filter option, e.g. "Lv 30 · Coal". Level leads because the level is what the list
   *  ranks by — the set name is how a player says it. */
  setOption: (group: InventorySetGroup) => string;
  /** How many gear pieces of that set the account holds, at the row's right edge. Localized by
   *  the caller: it is a number, and a thousands separator is not the same in every locale. */
  setOptionCount: (group: InventorySetGroup) => string;
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
  /** Omitted by a shell with no market snapshot, which then renders exactly as it did before. */
  priceOf?: (entry: InventoryEntry) => MarketPriceView | null;
  priceLabels?: MarketPriceLabels;
  renderPriceAction?: (entry: InventoryEntry) => ReactNode;
}

function unknownCategoryCodes(group: InventoryGroup): number[] {
  const codes = new Set<number>();
  for (const entry of group.entries) {
    if (entry.item.categoryCode !== null) codes.add(entry.item.categoryCode);
  }
  return [...codes].sort((a, b) => a - b);
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
}

/**
 * The stack mark: three stacked plates. Inline rather than a design system icon because it is
 * game vocabulary ("this is a pile of the same thing"), not UI chrome, and it is used in exactly
 * one place — the registry it would otherwise join is budgeted for chrome shared across screens.
 */
function StackGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
      strokeLinecap="round"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M8 1.6 14.4 5 8 8.4 1.6 5 8 1.6Z" />
      <path d="m1.6 8 6.4 3.4L14.4 8" />
      <path d="m1.6 11 6.4 3.4L14.4 11" />
    </svg>
  );
}

/** Four is what a Mítico rolls; showing all six of a future tier would push the footer around. */
const MAX_STAT_LINES = 4;

/** The ritual caps at three; anything past that is a bad read, not a taller row of stars. */
const MAX_HERO_STARS = 3;

/**
 * The equipping hero, as the roster's own identity block at card scale: avatar beside two lines —
 * rank, name and stars on the first, level on the second.
 *
 * Deliberately not {@link HeroIdentity}: that block carries a rarity WORD of its own and sizes
 * for a roster row, where this has to sit beside the sell value in a card footer. What it does
 * borrow is the alignment rule — rank and name share a baseline, so a bold `S` does not ride
 * above the name next to it.
 */
function EquippedByRow({ hero }: { hero: InventoryEquippedBy }) {
  if (hero.unknown) {
    return (
      <span data-testid="inventory-card-hero" className="min-w-0 truncate text-xs text-muted">
        {hero.name}
      </span>
    );
  }

  const stars = Math.max(0, Math.min(MAX_HERO_STARS, Math.round(hero.stars)));

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <HeroAvatar
        skin={hero.skin}
        rarityIdx={hero.rarityIdx}
        size="xs"
        name={hero.name}
        className="shrink-0"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-1">
          {hero.rank ? (
            <span className="shrink-0 text-[11px] font-black tracking-tight text-accent">
              {hero.rank}
            </span>
          ) : null}
          <span
            data-testid="inventory-card-hero"
            className={cn(
              "min-w-0 truncate text-xs font-bold",
              rarityTextClass(hero.rarityIdx) ?? "text-ink"
            )}
          >
            {hero.name}
          </span>
          {stars > 0 ? (
            <span
              className="shrink-0 text-[10px] tracking-tight text-rar-4"
              aria-hidden
            >
              {"★".repeat(stars)}
            </span>
          ) : null}
        </span>
        {hero.level ? (
          <span className="text-[10px] leading-none tabular-nums text-muted">
            {hero.level}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * One hero in the filter dropdown, drawn the way the card's own footer draws them: rank, name in
 * the hero's tier colour, stars, level. A bare name would make this list the one place on the
 * screen where a hero is not recognisable at a glance.
 */
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

/**
 * Memoised, and the sort path is why it pays: `sortInventoryView` re-sorts a COPY of each group's
 * array, so every `InventoryEntry` object survives with the same reference. Reordering the grid
 * therefore re-renders nothing — React only moves the host nodes it already has.
 *
 * That only holds while `labels` is stable, which is the shells' side of the bargain: both build
 * it in a `useMemo`, and the desktop's had to be re-keyed off the account SECTIONS to keep it.
 *
 * It buys nothing in the web planner, where the React Compiler already emits this bailout — the
 * measured floor there is under a microsecond a card against the desktop's 71. It is here for the
 * shell that has no compiler, and as the guarantee that does not depend on having one.
 */
const InventoryCard = memo(function InventoryCard({
  entry,
  labels,
  onSelect,
  price,
  priceLabels,
  priceAction,
}: {
  entry: InventoryEntry;
  labels: InventoryGridLabels;
  onSelect?: (item: InventoryViewItem) => void;
  price?: MarketPriceView | null;
  priceLabels?: MarketPriceLabels;
  priceAction?: ReactNode;
}) {
  const { item, count } = entry;
  const rarity = labels.itemRarity(item);
  const level = labels.itemLevel(item);
  const forge = labels.itemForge(item);
  const badges = labels.badges(item);
  // The name only carries the tier colour when nothing below it does — which is exactly the
  // kinds whose name IS their tier.
  const detailParts = [rarity, level, forge].filter(Boolean);
  const equippedBy = labels.equippedBy?.(item) ?? null;
  const stats = item.stats.slice(0, MAX_STAT_LINES);
  const tone = inventoryCardTone(item.rarityIdx, item.kind !== 'other');
  const interactive = Boolean(onSelect);
  // Reserved for every card once the shell prices at all, so a listed item does not make its row
  // taller than the one beside it.
  const pricedColumn = priceLabels != null;

  const body = (
    <>
      <span className="flex min-w-0 items-start gap-2.5">
        <ItemIcon item={item} size="xl" className="shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-start gap-1.5">
            <span
              data-testid="inventory-card-name"
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-semibold",
                rarity
                  ? "text-ink"
                  : rarityTextClass(item.rarityIdx) ?? "text-ink"
              )}
            >
              {labels.itemName(item)}
            </span>
          </span>
          {detailParts.length > 0 ? (
            <span className="flex min-w-0 items-baseline gap-1 text-xs">
              {rarity ? (
                <span
                  className={cn(
                    "shrink-0 font-medium",
                    rarityTextClass(item.rarityIdx) ?? "text-ink"
                  )}
                >
                  {rarity}
                </span>
              ) : null}
              {level ? (
                <>
                  {rarity ? (
                    <span className="shrink-0 text-muted">&middot;</span>
                  ) : null}
                  <span className="truncate text-muted">{level}</span>
                </>
              ) : null}
              {forge ? (
                <>
                  <span className="shrink-0 text-muted">&middot;</span>
                  <span className="shrink-0 font-semibold text-accent">
                    {forge}
                  </span>
                </>
              ) : null}
            </span>
          ) : null}
          {badges.length > 0 ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  className={inventoryBadgeRecipe({ tone: badge.tone })}
                >
                  {badge.label}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </span>

      {stats.length > 0 ? (
        <span className={inventoryStatsPanelClass}>
          {stats.map((stat) => {
            const text = labels.itemStat(stat);
            return (
              <span key={stat.code} className={inventoryStatRowClass}>
                <span className={inventoryStatLabelClass}>{text.label}</span>
                <span className={inventoryStatLeaderClass} aria-hidden="true" />
                <span
                  data-testid="inventory-stat-value"
                  className={inventoryStatValueClass}
                >
                  {text.value}
                </span>
              </span>
            );
          })}
        </span>
      ) : null}

    </>
  );

  // `mt-auto` is what pins this row to the bottom edge whatever sits above it, so a Comum
  // carrying one stat and a Mítico carrying four still line their footers up across a row.
  const footer = (
      <span
        data-testid="inventory-card-footer"
        className={inventoryFooterClass}
      >
        {/* One slot, two tenants that never coincide: only gear is worn, and only the fungible
            kinds stack. */}
        {equippedBy ? (
          <EquippedByRow hero={equippedBy} />
        ) : count > 1 ? (
          <span data-testid="inventory-card-count" className={inventoryCountClass}>
            <StackGlyph />
            <span className={inventoryCountValueClass}>{count}</span>
          </span>
        ) : (
          <span />
        )}
        {/* One right-hand column, market price above gold. The column is what the footer ends
            with, so the gold value stays on the footer's bottom edge whether or not a price sits
            over it, and the reserved line keeps every footer the same height — a card that grew
            only when its item happened to be listed would make the grid jump row to row. */}
        {entry.sellValueGold > 0 || pricedColumn ? (
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            {pricedColumn ? (
              <span className="flex min-h-4 items-center">
                {price != null && priceLabels != null ? (
                  <MarketPrice price={price} labels={priceLabels} action={priceAction} />
                ) : null}
              </span>
            ) : null}
            {entry.sellValueGold > 0 ? (
              <span className="flex items-center gap-1 text-xs tabular-nums text-muted">
                <GoldIcon className="size-3.5" />
                {labels.gold(entry.sellValueGold)}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
  );

  // A stable hook for the desktop smoke, which drives the real window: the card is otherwise
  // only addressable by its generated class shape, and that moves whenever the recipe does.
  if (!interactive) {
    return (
      <div
        data-testid="inventory-card"
        className={inventoryCardRecipe({ tone, interactive: false })}
      >
        {body}
        {footer}
      </div>
    );
  }

  // The footer sits OUTSIDE the button: it carries a link out to the market, and an anchor inside
  // a button is invalid and unreliable to click. The button keeps the whole body above it.
  return (
    <div
      data-testid="inventory-card"
      className={inventoryCardRecipe({ tone, interactive: true })}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col gap-2 text-left"
        onClick={() => onSelect?.(item)}
      >
        {body}
      </button>
      {footer}
    </div>
  );
});

function InventoryToolbar({
  view,
  labels,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  shown,
}: {
  view: InventoryView;
  labels: InventoryGridLabels;
  filter: InventoryFilter;
  onFilterChange: (next: InventoryFilter) => void;
  sort: InventorySort;
  onSortChange: (next: InventorySort) => void;
  shown: number;
}) {
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

/**
 * The inventory surface both shells render. Takes the domain's grouped view as-is and owns no
 * strings of its own — every label arrives through {@link InventoryGridLabels} so the web planner
 * and the desktop can each supply their own locale.
 */
export function InventoryGrid({
  view,
  labels,
  onSelectItem,
  className,
  priceOf,
  priceLabels,
  renderPriceAction,
}: InventoryGridProps) {
  const [filter, setFilter] = useState<InventoryFilter>(EMPTY_INVENTORY_FILTER);
  const [sort, setSort] = useState<InventorySort>(DEFAULT_INVENTORY_SORT);

  const filtered = useMemo(
    () => filterInventoryView(view, filter, labels.searchText),
    [view, filter, labels]
  );
  const sorted = useMemo(
    () => sortInventoryView(filtered, sort, labels.itemName, (entry) => priceOf?.(entry)?.amount ?? null),
    [filtered, sort, labels, priceOf]
  );

  if (view.items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 px-6 py-10 text-center",
          className
        )}
      >
        <h2 className="text-base font-semibold text-ink">
          {labels.empty.title}
        </h2>
        {labels.empty.description ? (
          <p className="max-w-prose text-sm text-muted">
            {labels.empty.description}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <InventoryToolbar
        view={view}
        labels={labels}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        shown={sorted.items.length}
      />

      {sorted.items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          {labels.toolbar.noMatches}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {sorted.groups.map((group) => {
            const codes =
              group.kind === "other" ? unknownCategoryCodes(group) : [];
            const note =
              codes.length > 0
                ? labels.unknownCategoryNote?.(codes)
                : undefined;

            return (
              <section
                key={group.kind}
                data-testid="inventory-group"
                data-kind={group.kind}
                className="flex flex-col gap-2"
              >
                <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-sm font-semibold text-ink">
                    {labels.groupTitle(group.kind)}
                  </h3>
                  <span className="text-xs tabular-nums text-muted">
                    {group.count}
                  </span>
                  {note ? (
                    <span className="text-xs text-muted">{note}</span>
                  ) : null}
                </header>
                <div className={inventoryGridClass}>
                  {group.entries.map((entry) => (
                    <InventoryCard
                      key={entry.key}
                      entry={entry}
                      labels={labels}
                      onSelect={onSelectItem}
                      price={priceOf?.(entry) ?? null}
                      priceLabels={priceLabels}
                      priceAction={renderPriceAction?.(entry)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view.skipped > 0 && labels.skippedNote ? (
        <p className="pt-3 text-xs text-muted">
          {labels.skippedNote(view.skipped)}
        </p>
      ) : null}
    </div>
  );
}
