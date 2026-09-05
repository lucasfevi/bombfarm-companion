'use client';

import { useEffect, useState } from 'react';
import { HeroAvatar, inventoryChipRecipe, inventoryFieldClass, rarityTextClass } from '@bombfarm/game-art';
import { Button, cn, Select } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import {
  EMPTY_FORGE_FILTER,
  FORGE_MIN_FORGE_OPTIONS,
  isEmptyForgeFilter,
  type ForgeFilter,
  type ForgeMinForge,
} from '../../lib/forge/forge-rows';
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

function toggle(list: readonly number[], value: number): number[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function HeroOptionLabel({ hero }: { hero: ForgeHeroOption }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <HeroAvatar skin={hero.skin} rarityIdx={hero.rarityIdx} size="xs" name={hero.name} className="shrink-0" />
      {hero.rank ? <span className="shrink-0 text-[11px] font-black tracking-tight text-accent">{hero.rank}</span> : null}
      <span className={cn('truncate', 'font-semibold', rarityTextClass(hero.rarityIdx) ?? 'text-ink')}>{hero.name}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted">{hero.level}</span>
    </span>
  );
}

export function ForgeToolbar({
  heroes,
  filter,
  onFilterChange,
  slots,
  rarities,
  shown,
  total,
  heroHint,
  bag,
  capturedAt,
  stale,
  onRefresh,
  labels,
}: {
  heroes: readonly ForgeHeroOption[];
  filter: ForgeFilter;
  onFilterChange: (next: ForgeFilter) => void;
  slots: readonly string[];
  rarities: readonly number[];
  shown: number;
  total: number;
  heroHint: string | null;
  bag: { free: number; capacity: number } | null;
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

  return (
    <div data-testid="forge-toolbar" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {heroes.length > 0 ? (
          <Select
            size="compact"
            value={filter.heroId ?? ''}
            onChange={(event) => { onFilterChange({ ...filter, heroId: event.target.value || null }); }}
            aria-label={t.inventoryFilterHeroLabel}
            className="w-56 shrink-0"
          >
            <option value="">{t.inventoryFilterAllHeroes}</option>
            {heroes.map((hero) => (
              <option key={hero.id} value={hero.id}>
                <HeroOptionLabel hero={hero} />
              </option>
            ))}
          </Select>
        ) : null}

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
          className="w-32 shrink-0"
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
          value={String(filter.minForge)}
          onChange={(event) =>
            { onFilterChange({ ...filter, minForge: Number(event.target.value) as ForgeMinForge }); }
          }
          aria-label={t.forgeMinForgeLabel}
          className="w-32 shrink-0"
        >
          {FORGE_MIN_FORGE_OPTIONS.map((min) => (
            <option key={min} value={String(min)}>
              {labels.minForge(min)}
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

        <span className="ml-auto flex items-center gap-3">
          {bag ? (
            <span data-testid="forge-bag" className="text-xs tabular-nums text-muted">
              {sub(t.forgeBagFree, { free: labels.count(bag.free), capacity: labels.count(bag.capacity) })}
            </span>
          ) : null}
          <span className="flex flex-col items-end gap-0.5">
            <Button type="button" variant="default" data-testid="forge-refresh" onClick={onRefresh}>
              {t.farmRefresh}
            </Button>
            <span data-testid="forge-read-age" className={cn('text-[11px] leading-none', stale ? 'text-warn' : 'text-muted')}>
              {ageLine}
            </span>
          </span>
        </span>
      </div>

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
        {heroHint ? (
          <span data-testid="forge-hero-hint" className="ml-auto text-xs text-muted">
            {heroHint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
