'use client';

/**
 * What the roster is ordered by, whether shelved heroes are in it, and which abilities it is
 * narrowed to.
 *
 * It sits beside the layout switch and governs BOTH presentations, which is the point: the list
 * and the board are two shapes of one roster, so switching between them must not change which
 * heroes are on screen. A filter that applied to only one of them would make the switch look like
 * it had lost half the account.
 *
 * The sort pair is the Inventory's own control — a key and a direction sharing one outline — for
 * the same reason the layout glyphs are: one shape, one meaning, wherever this app orders a
 * collection.
 */
import { useMemo } from 'react';
import { abilityName } from '@bombfarm/domain/game-labels';
import {
  AbilityIcon,
  inventorySortDirectionClass,
  inventorySortGroupClass,
  inventorySortSelectClass,
} from '@bombfarm/game-art';
import { Icon, Select, Switch, Tooltip, cn, type Lang } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type CopyKey } from '../../lib/copy';
import type { RosterHeroRow } from './hero-roster-order';
import {
  ROSTER_SORT_KEYS,
  abilityFilterOptions,
  toggleAbilityFilter,
  type RosterFilter,
  type RosterSort,
  type RosterSortKey,
} from './roster-order';

/** Exhaustive by construction: a seventh sort key is a compile error here rather than a blank
 *  option in the menu. */
const SORT_KEY_LABEL: Record<RosterSortKey, CopyKey> = {
  roll: 'heroesSortRoll',
  power: 'heroesSortPower',
  level: 'heroesSortLevel',
  rarity: 'heroesSortRarity',
  rank: 'heroesSortRank',
  stars: 'heroesSortStars',
};

export type RosterToolbarActions = {
  onSort: (next: RosterSort) => void;
  onFilter: (next: RosterFilter) => void;
};

export function RosterToolbar({
  rows,
  sort,
  filter,
  actions,
}: {
  /** The whole roster — what the ability filter is offered against, never the narrowed list. */
  rows: readonly RosterHeroRow[];
  sort: RosterSort;
  filter: RosterFilter;
  actions: RosterToolbarActions;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const ascending = sort.direction === 'asc';
  const options = useMemo(
    () => abilityFilterOptions(rows, filter.abilityIds),
    [rows, filter.abilityIds],
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted">
        <Switch
          checked={filter.activeOnly}
          onCheckedChange={(next) => {
            actions.onFilter({ ...filter, activeOnly: next });
          }}
          aria-label={t.heroesFilterActiveHeroes}
        />
        {t.heroesFilterActiveHeroes}
      </label>
      <span className={inventorySortGroupClass}>
        <Select
          size="compact"
          value={sort.key}
          onChange={(event) => {
            actions.onSort({ ...sort, key: event.target.value as RosterSortKey });
          }}
          aria-label={t.heroesSortLabel}
          className={inventorySortSelectClass}
        >
          {ROSTER_SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {t[SORT_KEY_LABEL[key]]}
            </option>
          ))}
        </Select>
        {/* The design-system tooltip, never the native `title`, exactly as the Inventory's own
            direction button does it. */}
        <Tooltip.Root>
          <Tooltip.Trigger
            type="button"
            onClick={() => {
              actions.onSort({ ...sort, direction: ascending ? 'desc' : 'asc' });
            }}
            aria-label={ascending ? t.heroesSortAscending : t.heroesSortDescending}
            className={inventorySortDirectionClass}
          >
            <Icon name={ascending ? 'sort-ascending' : 'sort-descending'} size="sm" />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup>
                <p className="m-0 text-xs text-ink">
                  {ascending ? t.heroesSortAscending : t.heroesSortDescending}
                </p>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </span>
      <AbilityFilterStrip options={options} filter={filter} lang={lang} onFilter={actions.onFilter} />
    </div>
  );
}

/**
 * Every ability in the game as a row of icons: press one to keep only the heroes that own it.
 *
 * The ones no hero on this roster owns are drawn dimmed and cannot be pressed — a filter that
 * empties the roster is not an answer, and their presence is itself the answer to "which of these
 * do I have none of", which a list of only what you own cannot give.
 */
function AbilityFilterStrip({
  options,
  filter,
  lang,
  onFilter,
}: {
  options: readonly { id: string; owned: boolean; selected: boolean }[];
  filter: RosterFilter;
  lang: Lang;
  onFilter: (next: RosterFilter) => void;
}) {
  const t = useCopy();

  return (
    <span
      role="group"
      aria-label={t.heroesAbilityFilterLabel}
      className={cn('flex', 'flex-wrap', 'items-center', 'gap-0.5')}
    >
      {options.map((option) => {
        const name = abilityName(option.id, lang);
        const label = option.owned
          ? sub(t.heroesAbilityFilterOption, { ability: name })
          : sub(t.heroesAbilityFilterAbsent, { ability: name });
        return (
          <Tooltip.Root key={option.id}>
            <Tooltip.Trigger
              type="button"
              aria-pressed={option.selected}
              aria-label={label}
              disabled={!option.owned}
              data-testid={`heroes-ability-filter-${option.id}`}
              onClick={() => {
                onFilter({
                  ...filter,
                  abilityIds: toggleAbilityFilter(filter.abilityIds, option.id),
                });
              }}
              // The border is always there and always the same width, so pressing one moves
              // nothing; only its colour changes. An `outline` with an offset draws outside the
              // button instead — over the icons either side of it, and clipped by the strip.
              className={cn(
                'rounded-sm',
                'border',
                'bg-transparent',
                'p-px',
                'focus-visible:[outline:2px_solid_var(--accent)]',
                option.owned ? 'cursor-pointer' : cn('cursor-default', 'opacity-30', 'grayscale'),
                option.selected
                  ? cn('border-accent', 'bg-[color-mix(in_oklch,var(--accent)_18%,transparent)]')
                  : 'border-transparent',
              )}
            >
              <AbilityIcon code={option.id} size="xs" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 font-semibold text-ink">{name}</p>
                  <p className="m-0 text-xs text-muted">{label}</p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </span>
  );
}
