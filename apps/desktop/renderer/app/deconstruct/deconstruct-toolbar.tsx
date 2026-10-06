'use client';

import { inventoryChipRecipe, inventoryFieldClass, inventoryFieldHeightClass, rarityTextClass } from '@bombfarm/game-art';
import type { InventorySetGroup, ItemKind } from '@bombfarm/domain/inventory-view';
import { Button, cn, Num, Select, SelectMultiple, Tooltip } from '@bombfarm/ui';
import { useMemo } from 'react';
import { sub, useCopy } from '../../lib/copy';
import {
  DECONSTRUCT_LOCATIONS,
  EMPTY_DECONSTRUCT_FILTER,
  isEmptyDeconstructFilter,
  type DeconstructBounds,
  type DeconstructFilter,
  type DeconstructLocation,
} from '../../lib/deconstruct/deconstruct-rows';
import { deconstructAddAllBlockText, type DeconstructAddAllBlock, type DeconstructLabels } from './deconstruct-labels';

export type DeconstructAddAll = {
  /** Shown rows that can be burned and are not in the batch yet. */
  readonly count: number;
  readonly block: DeconstructAddAllBlock | null;
  /** A burn is in flight; the batch is not the player's to change. */
  readonly busy: boolean;
  readonly onPress: () => void;
};

const NUM_FIELD_CLASS = cn(inventoryFieldHeightClass, 'min-h-[30px]', 'w-[4.75rem]', 'shrink-0');

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function locationOf(value: string): DeconstructLocation {
  return DECONSTRUCT_LOCATIONS.find((location) => location === value) ?? 'any';
}

export function DeconstructToolbar({
  filter,
  onFilterChange,
  kinds,
  rarities,
  sets,
  slots,
  levelBounds,
  topForge,
  anyInStash,
  shown,
  total,
  addAll,
  labels,
}: {
  filter: DeconstructFilter;
  onFilterChange: (next: DeconstructFilter) => void;
  /** Only the kinds the account holds, in the inventory's order. */
  kinds: readonly ItemKind[];
  rarities: readonly number[];
  sets: readonly InventorySetGroup[];
  slots: readonly string[];
  /** The gear levels present; `null` with no gear, which drops the range. */
  levelBounds: DeconstructBounds | null;
  /** The highest forge level present; `null` when nothing is forged, which drops the ceiling. */
  topForge: number | null;
  anyInStash: boolean;
  shown: number;
  total: number;
  addAll: DeconstructAddAll;
  labels: DeconstructLabels;
}) {
  const t = useCopy();
  const dirty = !isEmptyDeconstructFilter(filter);

  // A `null` `sets` means every set, so the boxes start ticked. Ticking the last one collapses
  // back to `null` rather than listing every set, which keeps the filter from reading as dirty
  // while it shows everything.
  const allSetIds = useMemo(() => sets.map((group) => group.set), [sets]);
  const selectedSets = filter.sets ?? allSetIds;
  const setsAreNarrowed = filter.sets !== null;

  // A narrowed location stays on screen even once the stash empties, so a filter nobody can see
  // is never left on.
  const showLocation = anyInStash || filter.location !== 'any';
  const showSets = sets.length > 1 || filter.sets !== null;
  const showSlots = slots.length > 1 || filter.slot !== null;
  const showKinds = kinds.length > 1 || filter.kinds.length > 0;
  const showRarities = rarities.length > 1 || filter.rarities.length > 0;

  const lowest = levelBounds === null ? 0 : (filter.minLevel ?? levelBounds.min);
  const highest = levelBounds === null ? 0 : (filter.maxLevel ?? levelBounds.max);

  return (
    <div data-testid="deconstruct-toolbar" className="flex flex-col gap-2">
      <input
        type="search"
        value={filter.text}
        onChange={(event) => { onFilterChange({ ...filter, text: event.target.value }); }}
        placeholder={t.deconstructSearchPlaceholder}
        aria-label={t.deconstructSearchLabel}
        className={cn(inventoryFieldClass, 'w-full')}
      />

      <div className="flex flex-wrap items-center gap-2">
        {showSets ? (
          <SelectMultiple
            size="compact"
            value={selectedSets}
            onValueChange={(next) => { onFilterChange({ ...filter, sets: next.length === allSetIds.length ? null : next }); }}
            aria-label={t.inventoryFilterSetsLabel}
            className={cn(inventoryFieldHeightClass, 'w-40', 'shrink-0')}
            renderValue={() =>
              filter.sets
                ? sub(t.inventoryFilterSetsSelected, { chosen: filter.sets.length, total: allSetIds.length })
                : t.inventoryFilterAllSets
            }
            header={{
              label: t.inventoryFilterSetsOwned,
              action: setsAreNarrowed
                ? { label: t.inventoryFilterSelectAllSets, onAction: () => { onFilterChange({ ...filter, sets: null }); } }
                : { label: t.inventoryFilterClear, onAction: () => { onFilterChange({ ...filter, sets: [] }); } },
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

        {showSlots ? (
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
        ) : null}

        {showLocation ? (
          <Select
            size="compact"
            value={filter.location}
            onChange={(event) => { onFilterChange({ ...filter, location: locationOf(event.target.value) }); }}
            aria-label={t.deconstructLocationLabel}
            className={cn(inventoryFieldHeightClass, 'w-44', 'shrink-0')}
          >
            {DECONSTRUCT_LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {labels.locationName(location)}
              </option>
            ))}
          </Select>
        ) : null}

        {levelBounds !== null && levelBounds.min < levelBounds.max ? (
          <div data-testid="deconstruct-level-range" className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <span>{t.deconstructLevelLabel}</span>
            <Num
              value={lowest}
              step={1}
              decimals={0}
              min={levelBounds.min}
              max={highest}
              incrementLabel={t.deconstructLevelMinUp}
              decrementLabel={t.deconstructLevelMinDown}
              className={NUM_FIELD_CLASS}
              onChange={(next) => { onFilterChange({ ...filter, minLevel: next <= levelBounds.min ? null : next }); }}
            />
            <span>{t.deconstructLevelTo}</span>
            <Num
              value={highest}
              step={1}
              decimals={0}
              min={lowest}
              max={levelBounds.max}
              incrementLabel={t.deconstructLevelMaxUp}
              decrementLabel={t.deconstructLevelMaxDown}
              className={NUM_FIELD_CLASS}
              onChange={(next) => { onFilterChange({ ...filter, maxLevel: next >= levelBounds.max ? null : next }); }}
            />
          </div>
        ) : null}

        {topForge !== null ? (
          // A ceiling is meaningless next to "hide forged", which already is the ceiling at zero,
          // so the pair is disabled together rather than hidden — the row keeps its shape.
          <fieldset
            disabled={filter.hideForged}
            data-testid="deconstruct-forge-ceiling"
            className="m-0 flex shrink-0 items-center gap-1.5 border-0 p-0 text-xs text-muted disabled:opacity-50"
          >
            <span>{t.deconstructForgeUpToLabel}</span>
            <Num
              value={filter.maxForge ?? topForge}
              step={1}
              decimals={0}
              min={0}
              max={topForge}
              incrementLabel={t.deconstructForgeUp}
              decrementLabel={t.deconstructForgeDown}
              className={NUM_FIELD_CLASS}
              onChange={(next) => { onFilterChange({ ...filter, maxForge: next >= topForge ? null : next }); }}
            />
          </fieldset>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {dirty ? (
            <Button
              type="button"
              variant="primary"
              data-testid="deconstruct-clear-filter"
              onClick={() => { onFilterChange(EMPTY_DECONSTRUCT_FILTER); }}
              className={cn(inventoryFieldHeightClass, 'shrink-0')}
            >
              {t.inventoryFilterClear}
            </Button>
          ) : null}
          <span data-testid="deconstruct-result-count" className="shrink-0 text-xs tabular-nums text-muted">
            {sub(t.inventoryFilterCount, { shown, total })}
          </span>
          {/* The trigger is the wrapper, not the button: a tooltip trigger drops `disabled`, and a
              button with nothing to add must stay inert. The reason is the only thing the tooltip
              says, so it is off while there is none. */}
          <Tooltip.Provider>
            <Tooltip.Root disabled={addAll.block === null}>
              <Tooltip.Trigger render={<span className="inline-flex" />}>
                <Button
                  type="button"
                  variant="default"
                  data-testid="deconstruct-select-shown"
                  disabled={addAll.busy || addAll.block !== null}
                  onClick={addAll.onPress}
                  className={cn(inventoryFieldHeightClass, 'min-w-[11.5rem]', 'shrink-0', 'whitespace-nowrap', 'tabular-nums')}
                >
                  {sub(t.deconstructAddAll, { count: labels.count(addAll.count) })}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0">{addAll.block === null ? '' : deconstructAddAllBlockText(addAll.block, t)}</p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showKinds ? (
          <div role="group" aria-label={t.deconstructKindsLabel} className="flex flex-wrap items-center gap-1.5">
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                data-testid="deconstruct-kind-chip"
                data-kind={kind}
                aria-pressed={filter.kinds.includes(kind)}
                onClick={() => { onFilterChange({ ...filter, kinds: toggle(filter.kinds, kind) }); }}
                className={inventoryChipRecipe({ active: filter.kinds.includes(kind) })}
              >
                {labels.kindName(kind)}
              </button>
            ))}
          </div>
        ) : null}
        {showKinds && showRarities ? <span aria-hidden className="mx-1 h-4 w-px bg-line" /> : null}
        {showRarities ? (
          <div role="group" aria-label={t.deconstructRaritiesLabel} className="flex flex-wrap items-center gap-1.5">
            {rarities.map((rarityIdx) => (
              <button
                key={rarityIdx}
                type="button"
                data-testid="deconstruct-rarity-chip"
                data-rarity={rarityIdx}
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
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="deconstruct-hide-forged"
            aria-pressed={filter.hideForged}
            onClick={() => { onFilterChange({ ...filter, hideForged: !filter.hideForged }); }}
            className={inventoryChipRecipe({ active: filter.hideForged })}
          >
            {t.deconstructHideForged}
          </button>
          <button
            type="button"
            data-testid="deconstruct-hide-unburnable"
            aria-pressed={filter.hideUnburnable}
            onClick={() => { onFilterChange({ ...filter, hideUnburnable: !filter.hideUnburnable }); }}
            className={inventoryChipRecipe({ active: filter.hideUnburnable })}
          >
            {t.deconstructHideUnburnable}
          </button>
          <button
            type="button"
            data-testid="deconstruct-selected-only"
            aria-pressed={filter.selectedOnly}
            onClick={() => { onFilterChange({ ...filter, selectedOnly: !filter.selectedOnly }); }}
            className={inventoryChipRecipe({ active: filter.selectedOnly })}
          >
            {t.deconstructSelectedOnly}
          </button>
        </div>
      </div>
    </div>
  );
}
