'use client';

/**
 * What the roster is ordered by, whether shelved heroes are in it, which abilities it is narrowed
 * to, and which of the two shapes it is drawn in.
 *
 * It governs BOTH presentations, which is the point: the list and the board are two shapes of one
 * roster, so switching between them must not change which heroes are on screen. A filter that
 * applied to only one of them would make the switch look like it had lost half the account. The
 * layout switch is inside this control rather than beside it for the same reason — it is the
 * fourth thing you can ask of a roster, and a host that placed it itself could place it somewhere
 * the other host does not.
 *
 * The sort pair is the Inventory's own control — a key and a direction sharing one outline — for
 * the same reason the layout glyphs are: one shape, one meaning, wherever this app orders a
 * collection.
 */
import { useMemo } from 'react';
import { abilityName } from '@bombfarm/domain/game-labels';
import {
  AbilityIcon,
  InventoryLayoutToggle,
  inventorySortDirectionClass,
  inventorySortGroupClass,
  inventorySortSelectClass,
} from '@bombfarm/game-art';
import { Icon, Select, Switch, Tooltip, cn } from '@bombfarm/ui';
import { sub, type Lang, type RosterBoardCopy } from '../../copy';
import {
  ROSTER_BOARD_SORT_KEYS,
  abilityFilterOptions,
  pressAbilityFilter,
  type RosterAbilityFilterOption,
  type RosterBoardFilter,
  type RosterBoardSort,
  type RosterBoardSortKey,
  type RosterHeroRow,
  type RosterViewMode,
} from '../../model';

/** Exhaustive by construction: a seventh sort key is a compile error here rather than a blank
 *  option in the menu. */
const SORT_KEY_LABEL: Record<RosterBoardSortKey, keyof RosterBoardCopy> = {
  roll: 'heroesSortRoll',
  power: 'heroesSortPower',
  level: 'heroesSortLevel',
  rarity: 'heroesSortRarity',
  rank: 'heroesSortRank',
  stars: 'heroesSortStars',
};

/**
 * Grouped rather than spread flat, the same shape the picker's own view takes: the three writes
 * are one thing — how this roster is being looked at — and a host wires all three or none.
 */
export type RosterToolbarActions = {
  onSort: (next: RosterBoardSort) => void;
  onFilter: (next: RosterBoardFilter) => void;
  onViewMode: (next: RosterViewMode) => void;
};

export function RosterToolbar({
  rows,
  sort,
  filter,
  viewMode,
  actions,
  t,
  lang,
}: {
  /** The whole roster — what the ability filter is offered against, never the narrowed list. */
  rows: readonly RosterHeroRow[];
  sort: RosterBoardSort;
  filter: RosterBoardFilter;
  viewMode: RosterViewMode;
  actions: RosterToolbarActions;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  const ascending = sort.direction === 'asc';
  const options = useMemo(
    () => abilityFilterOptions(rows, filter.abilityIds),
    [rows, filter.abilityIds],
  );
  const viewToggleLabels = useMemo(
    () => ({ group: t.heroesViewLabel, cards: t.heroesViewCards, list: t.heroesViewList }),
    [t],
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <label
          data-testid="heroes-filter-active"
          className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted"
        >
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
              actions.onSort({ ...sort, key: event.target.value as RosterBoardSortKey });
            }}
            aria-label={t.heroesSortLabel}
            className={inventorySortSelectClass}
          >
            {ROSTER_BOARD_SORT_KEYS.map((key) => (
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
        <AbilityFilterStrip
          options={options}
          filter={filter}
          lang={lang}
          t={t}
          onFilter={actions.onFilter}
        />
      </div>
      {/* The Inventory's own control, for the same two shapes: one pair of glyphs means one thing
          wherever this app switches between a board and a list. */}
      <InventoryLayoutToggle
        layout={viewMode}
        onChange={actions.onViewMode}
        labels={viewToggleLabels}
      />
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
  t,
  onFilter,
}: {
  options: readonly RosterAbilityFilterOption[];
  filter: RosterBoardFilter;
  lang: Lang;
  t: RosterBoardCopy;
  onFilter: (next: RosterBoardFilter) => void;
}) {
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
        const selectedFrameClass = option.selected
          ? cn('border-accent', 'bg-[color-mix(in_oklch,var(--accent)_28%,transparent)]')
          : '';
        return (
          <Tooltip.Root key={option.id}>
            <Tooltip.Trigger
              type="button"
              aria-pressed={option.selected}
              aria-label={label}
              // `aria-disabled`, not `disabled`. The tooltip primitive drops a `disabled`
              // attribute on its trigger — a disabled element receives no hover, and this tile's
              // tooltip is the whole reason an ability nobody owns is drawn at all — so the DOM
              // cannot refuse the press and `pressAbilityFilter` refuses it instead.
              aria-disabled={option.owned ? undefined : true}
              data-testid={`heroes-ability-filter-${option.id}`}
              onClick={() => {
                onFilter({
                  ...filter,
                  abilityIds: pressAbilityFilter(filter.abilityIds, option),
                });
              }}
              // Pressed is marked by recolouring the icon's own frame, never by a frame on the
              // button: the icon already draws one, so a second would read as two concentric
              // frames and make the pressed icon wider than its neighbours. An `outline` grows
              // it the same way, and would fight the focus ring for the same property.
              className={cn(
                'rounded-sm',
                'border-0',
                'bg-transparent',
                'p-0',
                'focus-visible:[outline:2px_solid_var(--accent)]',
                option.owned ? 'cursor-pointer' : cn('cursor-default', 'opacity-30', 'grayscale'),
              )}
            >
              <AbilityIcon code={option.id} size="xs" className={selectedFrameClass} />
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
