import { memo, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_INVENTORY_SORT,
  EMPTY_INVENTORY_FILTER,
  filterInventoryView,
  sortInventoryView,
  type InventoryEntry,
  type InventoryFilter,
  type InventoryGroup,
  type InventorySetGroup,
  type InventorySort,
  type InventoryView,
  type InventoryViewItem,
  type InventoryViewStat,
  type ItemKind,
} from "@bombfarm/domain/inventory-view";
import { cn } from "@bombfarm/ui";
import { GoldIcon } from "./gold-icon";
import { MarketPrice, type MarketPriceLabels, type MarketPriceView } from "./market-price";
import { HeroAvatar } from "./hero-avatar";
import { ItemIcon } from "./item-icon";
import { rarityTextClass } from "./game-art.recipe";
import {
  InventoryToolbar,
  MAX_HERO_STARS,
  type InventoryHeroOption,
  type InventoryToolbarLabels,
} from "./inventory-toolbar";
import {
  inventoryBadgeRecipe,
  inventoryCardRecipe,
  inventoryCardTone,
  inventoryCountClass,
  inventoryCountValueClass,
  inventoryFooterClass,
  inventoryGridClass,
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
  equippedBy?: ((item: InventoryViewItem) => InventoryEquippedBy | null) | undefined;
  /** Names the hero filter's options; a caller with no roster returns the id. */
  heroOption?: ((heroId: string) => InventoryHeroOption) | undefined;
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
  unknownCategoryNote?: ((codes: readonly number[]) => string) | undefined;
  skippedNote?: ((count: number) => string) | undefined;
  empty: { title: string; description?: string | undefined };
}

export interface InventoryGridProps {
  view: InventoryView;
  labels: InventoryGridLabels;
  onSelectItem?: ((item: InventoryViewItem) => void) | undefined;
  className?: string | undefined;
  /** Omitted by a shell with no market snapshot, which then renders exactly as it did before. */
  priceOf?: ((entry: InventoryEntry) => MarketPriceView | null) | undefined;
  priceLabels?: MarketPriceLabels | undefined;
  /** Whether the market is quoting a price for one item right now — the `Priced` chip's predicate.
   *  Supplied by the host, which owns the snapshot; absent drops the chip. */
  isPricedItem?: ((item: InventoryViewItem) => boolean) | undefined;
  /** Slot at the toolbar's right edge, in the corner of the list itself. */
  toolbarActions?: ReactNode;
  renderPriceAction?: ((entry: InventoryEntry) => ReactNode) | undefined;
}

function unknownCategoryCodes(group: InventoryGroup): number[] {
  const codes = new Set<number>();
  for (const entry of group.entries) {
    if (entry.item.categoryCode !== null) codes.add(entry.item.categoryCode);
  }
  return [...codes].sort((a, b) => a - b);
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
  onSelect?: ((item: InventoryViewItem) => void) | undefined;
  price?: MarketPriceView | null | undefined;
  priceLabels?: MarketPriceLabels | undefined;
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
  isPricedItem,
  toolbarActions,
  renderPriceAction,
}: InventoryGridProps) {
  const [filter, setFilter] = useState<InventoryFilter>(EMPTY_INVENTORY_FILTER);
  const [sort, setSort] = useState<InventorySort>(DEFAULT_INVENTORY_SORT);

  const filtered = useMemo(
    () => filterInventoryView(view, filter, labels.searchText, isPricedItem),
    [view, filter, labels, isPricedItem]
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
    <div className={cn("flex min-h-0 flex-col", className)}>
      <InventoryToolbar
        view={view}
        labels={labels}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        shown={sorted.items.length}
        showPricedOnly={isPricedItem != null}
        actions={toolbarActions}
      />

      {sorted.items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted">
          {labels.toolbar.noMatches}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
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
