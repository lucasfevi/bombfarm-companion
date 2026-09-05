'use client';

import { useEffect, useState } from 'react';
import {
  HeroAvatar,
  inventoryChipRecipe,
  inventoryFieldClass,
  inventoryFieldHeightClass,
  inventorySortDirectionClass,
  inventorySortGroupClass,
  inventorySortSelectClass,
  rarityTextClass,
} from '@bombfarm/game-art';
import {
  sortDirectionFor,
  withSortTerm,
  type InventorySort,
  type InventorySortKey,
} from '@bombfarm/domain/inventory-view';
import { Button, cn, Icon, Select, Tooltip } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import {
  EMPTY_FORGE_FILTER,
  FORGE_MAX_FORGE_RUNGS,
  isEmptyForgeFilter,
  type ForgeFilter,
  type ForgeMaxForge,
  type ForgeWorn,
} from '../../lib/forge/forge-rows';
import { DEFAULT_FORGE_SORT, FORGE_SORT_KEYS } from '../../lib/forge/forge-store';
import type { ForgeLabels } from './forge-labels';

export type ForgeHeroOption = {
  id: string;
  name: string;
  rank: string;
  rarityIdx: number;
  skin: number;
  /** Already localised, e.g. "Level 85". */
  level: string;
  inField: boolean;
};

const AGE_TICK_MS = 15_000;

const FORGE_WORN_OPTIONS: readonly ForgeWorn[] = ['all', 'worn', 'spare'];

/** The value the ceiling select carries for "every rung" — `0` is a real rung here, so the
 *  filter-off state cannot borrow it the way a floor could. */
const ANY_FORGE = '';

function toggle(list: readonly number[], value: number): number[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function maxForgeOf(value: string): ForgeMaxForge {
  return value === ANY_FORGE ? null : (Number(value) as ForgeMaxForge);
}

/** The avatar is sized to the toolbar's field height rather than to its own `xs` step: a control
 *  in this row stands the same height as the fields beside it, so the picture gives way. */
function HeroOptionLabel({ hero }: { hero: ForgeHeroOption }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <HeroAvatar skin={hero.skin} rarityIdx={hero.rarityIdx} size="xs" name={hero.name} className="size-5 shrink-0" />
      {hero.rank ? <span className="shrink-0 text-[11px] font-black tracking-tight text-accent">{hero.rank}</span> : null}
      <span className={cn('truncate', 'font-semibold', rarityTextClass(hero.rarityIdx) ?? 'text-ink')}>{hero.name}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted">{hero.level}</span>
    </span>
  );
}

/**
 * The order the bag stands in, and which way. The bag table sorts from its own Item, Slot and
 * Forge headers too; this is the only way to reach the two orders whose columns the table does
 * not carry, and it names whichever order is leading however it was chosen.
 */
function SortPicker({
  sort,
  onSortChange,
  labels,
}: {
  sort: InventorySort;
  onSortChange: (next: InventorySort) => void;
  labels: ForgeLabels;
}) {
  const t = useCopy();
  const primary = sort[0] ?? DEFAULT_FORGE_SORT[0] ?? { key: 'forge' as const, direction: 'desc' as const };
  const ascending = primary.direction === 'asc';
  const directionLabel = ascending ? t.inventorySortAscending : t.inventorySortDescending;

  return (
    <span className={inventorySortGroupClass}>
      <Select
        size="compact"
        value={primary.key}
        onChange={(event) => {
          const key = event.target.value as InventorySortKey;
          onSortChange(withSortTerm(sort, { key, direction: sortDirectionFor(sort, key) ?? 'desc' }));
        }}
        aria-label={t.inventorySortLabel}
        className={inventorySortSelectClass}
      >
        {FORGE_SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {labels.sortKey(key)}
          </option>
        ))}
      </Select>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          onClick={() => {
            onSortChange(withSortTerm(sort, { key: primary.key, direction: ascending ? 'desc' : 'asc' }));
          }}
          aria-label={directionLabel}
          className={inventorySortDirectionClass}
        >
          <Icon name={ascending ? 'sort-ascending' : 'sort-descending'} size="sm" />
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
  );
}

export function ForgeToolbar({
  heroes,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  slots,
  rarities,
  shown,
  total,
  heroHint,
  capturedAt,
  stale,
  onRefresh,
  labels,
}: {
  heroes: readonly ForgeHeroOption[];
  filter: ForgeFilter;
  onFilterChange: (next: ForgeFilter) => void;
  sort: InventorySort;
  onSortChange: (next: InventorySort) => void;
  slots: readonly string[];
  rarities: readonly number[];
  shown: number;
  total: number;
  heroHint: string | null;
  capturedAt: string | null;
  stale: boolean;
  onRefresh: () => void;
  labels: ForgeLabels;
}) {
  const t = useCopy();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, AGE_TICK_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const dirty = !isEmptyForgeFilter(filter);
  const ageLine = stale
    ? t.farmRefreshStale
    : capturedAt === null
      ? ''
      : sub(t.accountReadAge, { age: formatCapturedAt(capturedAt, t, now) });

  // A hero already means "worn, by that hero", so leaving this live would offer a second cut that
  // either says nothing or empties the table outright. It is frozen on the value the hero implies
  // instead, with the sentence beside it saying so.
  const wornImplied = filter.heroId !== null;
  const worn = wornImplied ? 'worn' : filter.worn;

  return (
    <div data-testid="forge-toolbar" className="flex flex-col gap-2">
      <Tooltip.Provider delay={200} closeDelay={80}>
        <div className="flex flex-wrap items-center gap-2">
          <SortPicker sort={sort} onSortChange={onSortChange} labels={labels} />

          {heroes.length > 0 ? (
            <Select
              size="compact"
              value={filter.heroId ?? ''}
              onChange={(event) => { onFilterChange({ ...filter, heroId: event.target.value || null }); }}
              aria-label={t.inventoryFilterHeroLabel}
              className={cn(inventoryFieldHeightClass, 'w-56', 'shrink-0')}
            >
              <option value="">{t.inventoryFilterAllHeroes}</option>
              {heroes.map((hero) => (
                <option key={hero.id} value={hero.id}>
                  <HeroOptionLabel hero={hero} />
                </option>
              ))}
            </Select>
          ) : null}

          <Select
            size="compact"
            value={worn}
            disabled={wornImplied}
            onChange={(event) => { onFilterChange({ ...filter, worn: event.target.value as ForgeWorn }); }}
            aria-label={t.forgeWornLabel}
            className={cn(inventoryFieldHeightClass, 'w-40', 'shrink-0')}
          >
            {FORGE_WORN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labels.worn(option)}
              </option>
            ))}
          </Select>

          <input
            type="search"
            value={filter.text}
            onChange={(event) => { onFilterChange({ ...filter, text: event.target.value }); }}
            placeholder={t.forgeSearchPlaceholder}
            aria-label={t.forgeSearchLabel}
            className={cn(inventoryFieldClass, 'min-w-40 flex-1')}
          />

          <Select
            size="compact"
            value={filter.slot ?? ''}
            onChange={(event) => { onFilterChange({ ...filter, slot: event.target.value || null }); }}
            aria-label={t.forgeSlotLabel}
            className={cn(inventoryFieldHeightClass, 'w-32', 'shrink-0')}
          >
            <option value="">{t.forgeAllSlots}</option>
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {labels.slotName(slot)}
              </option>
            ))}
          </Select>

          <Select
            size="compact"
            value={filter.maxForge === null ? ANY_FORGE : String(filter.maxForge)}
            onChange={(event) => { onFilterChange({ ...filter, maxForge: maxForgeOf(event.target.value) }); }}
            aria-label={t.forgeMaxForgeLabel}
            className={cn(inventoryFieldHeightClass, 'w-40', 'shrink-0')}
          >
            <option value={ANY_FORGE}>{labels.maxForge(null)}</option>
            {FORGE_MAX_FORGE_RUNGS.map((max) => (
              <option key={max} value={String(max)}>
                {labels.maxForge(max)}
              </option>
            ))}
          </Select>

          <span data-testid="forge-result-count" className="shrink-0 text-xs tabular-nums text-muted">
            {sub(t.inventoryFilterCount, { shown, total })}
          </span>
          {dirty ? (
            <button type="button" onClick={() => { onFilterChange(EMPTY_FORGE_FILTER); }} className={inventoryChipRecipe({ active: false })}>
              {t.inventoryFilterClear}
            </button>
          ) : null}

          <span className="ml-auto flex flex-col items-end gap-0.5">
            <Button type="button" variant="default" data-testid="forge-refresh" onClick={onRefresh}>
              {t.farmRefresh}
            </Button>
            <span data-testid="forge-read-age" className={cn('text-[11px] leading-none', stale ? 'text-warn' : 'text-muted')}>
              {ageLine}
            </span>
          </span>
        </div>
      </Tooltip.Provider>

      <div className="flex flex-wrap items-center gap-1.5">
        {rarities.map((rarityIdx) => (
          <button
            key={rarityIdx}
            type="button"
            aria-pressed={filter.rarities.includes(rarityIdx)}
            onClick={() => { onFilterChange({ ...filter, rarities: toggle(filter.rarities, rarityIdx) }); }}
            className={cn(
              inventoryChipRecipe({ active: filter.rarities.includes(rarityIdx) }),
              !filter.rarities.includes(rarityIdx) && rarityTextClass(rarityIdx),
            )}
          >
            {labels.rarityName(rarityIdx)}
          </button>
        ))}
        {wornImplied ? (
          <span data-testid="forge-worn-implied" className="text-xs text-muted">
            {t.forgeWornImplied}
          </span>
        ) : null}
        {heroHint ? (
          <span data-testid="forge-hero-hint" className="ml-auto text-xs text-muted">
            {heroHint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
