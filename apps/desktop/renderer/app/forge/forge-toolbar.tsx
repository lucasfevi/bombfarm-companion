'use client';

import {
  HeroAvatar,
  inventoryChipRecipe,
  inventoryFieldClass,
  inventoryFieldHeightClass,
  rarityTextClass,
} from '@bombfarm/game-art';
import { Button, cn, Select } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { EMPTY_FORGE_FILTER, FORGE_BANDS, isEmptyForgeFilter, type ForgeBand, type ForgeFilter } from '../../lib/forge/forge-rows';
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

/** The value the band select carries for "every rung": no band is named by the empty string. */
const ANY_FORGE = '';

function toggle(list: readonly number[], value: number): number[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function bandOf(value: string): ForgeBand | null {
  return value === ANY_FORGE ? null : (value as ForgeBand);
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

export function ForgeToolbar({
  heroes,
  filter,
  onFilterChange,
  slots,
  rarities,
  anyEquipped,
  shown,
  total,
  heroHint,
  labels,
}: {
  heroes: readonly ForgeHeroOption[];
  filter: ForgeFilter;
  onFilterChange: (next: ForgeFilter) => void;
  slots: readonly string[];
  rarities: readonly number[];
  /** Whether any piece in the bag is on a hero — the Equipped chip has nothing to offer otherwise. */
  anyEquipped: boolean;
  shown: number;
  total: number;
  heroHint: string | null;
  labels: ForgeLabels;
}) {
  const t = useCopy();

  const dirty = !isEmptyForgeFilter(filter);

  // A hero already means "worn, by that hero", so the chip beside it could only repeat the cut the
  // hero has already made. It goes away entirely rather than standing there pressed and inert —
  // the sentence at the end of the row is what says the bag is already narrowed to one wearer.
  const showEquipped = anyEquipped && filter.heroId === null;

  return (
    <div data-testid="forge-toolbar" className="flex flex-col gap-2">
      {/* The one control a reader reaches for first, and the one that wants the whole width: a
          search box sharing a line with fixed-width dropdowns is a search box that has to fight
          them for room every time the row wraps. */}
      <input
        type="search"
        value={filter.text}
        onChange={(event) => { onFilterChange({ ...filter, text: event.target.value }); }}
        placeholder={t.forgeSearchPlaceholder}
        aria-label={t.forgeSearchLabel}
        className={cn(inventoryFieldClass, 'w-full')}
      />

      <div className="flex flex-wrap items-center gap-2">
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
          value={filter.forge ?? ANY_FORGE}
          onChange={(event) => { onFilterChange({ ...filter, forge: bandOf(event.target.value) }); }}
          aria-label={t.forgeBandLabel}
          className={cn(inventoryFieldHeightClass, 'w-40', 'shrink-0')}
        >
          <option value={ANY_FORGE}>{labels.band(null)}</option>
          {FORGE_BANDS.map((band) => (
            <option key={band} value={band}>
              {labels.band(band)}
            </option>
          ))}
        </Select>

        <span data-testid="forge-result-count" className="ml-auto shrink-0 text-xs tabular-nums text-muted">
          {sub(t.inventoryFilterCount, { shown, total })}
        </span>
        {dirty ? (
          <Button
            type="button"
            variant="primary"
            data-testid="forge-clear-filter"
            onClick={() => { onFilterChange(EMPTY_FORGE_FILTER); }}
            className={cn(inventoryFieldHeightClass, 'shrink-0')}
          >
            {t.inventoryFilterClear}
          </Button>
        ) : null}
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
        {showEquipped ? (
          <button
            type="button"
            data-testid="forge-equipped-chip"
            aria-pressed={filter.worn}
            onClick={() => { onFilterChange({ ...filter, worn: !filter.worn }); }}
            className={inventoryChipRecipe({ active: filter.worn })}
          >
            {t.inventoryFilterEquipped}
          </button>
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
