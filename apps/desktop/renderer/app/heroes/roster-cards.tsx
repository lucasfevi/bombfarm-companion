'use client';

/**
 * The roster as a board of cards, one per hero, instead of a rail of names.
 *
 * The rail answers "who am I looking at"; the board answers "how does this hero compare to the
 * rest of them" — every hero's birth roll, ability pool and gear side by side, without clicking
 * through the roster one at a time. That is why it takes the whole screen rather than living in
 * the 19rem column: eight roll bars and sixteen icons do not fit in a rail, and shrunk until they
 * do they stop being readable, which is the only thing this view is for.
 *
 * Read-only, like every other panel on this screen. A card selects a hero and changes nothing.
 */
import { memo, useMemo, type ReactNode, type SyntheticEvent } from 'react';
import { motion } from 'motion/react';
import { abilityName } from '@bombfarm/domain/game-labels';
import { RARITIES, SHEET_PANEL_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import {
  AbilityIcon,
  HeroAbilityIcons,
  HeroGearIcons,
  HeroIdentity,
  inventorySortDirectionClass,
  inventorySortGroupClass,
  inventorySortSelectClass,
  rosterInactiveChromeClass,
} from '@bombfarm/game-art';
import { railTintFor, statRollRowsFor, type RollTint } from '@bombfarm/hero/model';
import {
  Icon,
  Panel,
  Select,
  Switch,
  Tooltip,
  cn,
  formatCompactNumber,
  formatNumber,
  panelHClass,
  panelTitleClass,
  type Lang,
} from '@bombfarm/ui';
import { sub, useCopy, useLocale, type CopyKey } from '../../lib/copy';
import { rollQualityText, type RosterHeroRow } from './hero-roster-order';
import {
  ROSTER_SORT_KEYS,
  abilityFilterOptions,
  type RosterBoardFilter,
  type RosterSort,
  type RosterSortKey,
} from './roster-board-order';

/** What a bar prints when the domain could place nothing — never a zero-length bar, which reads
 *  as the worst possible roll rather than as an absence of evidence. */
const NOT_PLACED = '—';

/** The detail panel's own tints, reused: a bar that reads "high" here has to read high there too,
 *  or one hero's roll means two different things on two screens. */
const TINT_CLASS: Record<RollTint, string> = {
  low: 'bg-down',
  mid: 'bg-warn',
  high: 'bg-up',
};

/** Cards arrive in order rather than all at once, so the eye is led across the board. Capped, so
 *  a large roster does not spend seconds dealing itself out. `MotionConfig reducedMotion="user"`
 *  upstream turns all of it off for a reader who asked for that. */
const CARD_STAGGER_SECONDS = 0.022;
const CARD_STAGGER_CAP = 12;

/** Three letters tell the bars apart once the tooltip carries the full name, and it is what
 *  keeps the strip legible at a quarter of a card's width. */
const BAR_LABEL_CHARS = 3;

/**
 * Each group wraps at a fixed count rather than filling the width.
 *
 * Eight gear tiles in one row set the card's width on their own — every card was then as wide as
 * its widest row and only three fitted across a large window. Wrapping the three groups at four,
 * three and four makes the card about half as wide, which is what puts five of them on a row and
 * lets the board do what it is for: the whole roster in one look.
 */
/**
 * The card's whole width: four gear tiles, the three gaps between them, and the card's own
 * padding — `4 × w-12 + 3 × gap-0.5 + 2 × p-2.5`.
 *
 * Fixed rather than a share of the row, because the gear row is the widest thing a card holds and
 * anything wider is empty space inside every card at once. The board then fits as many as the
 * window has room for instead of stretching a fixed few.
 */
const CARD_WIDTH = '13.625rem';

const ROLL_BARS_PER_ROW = cn('grid', 'grid-cols-4', 'gap-1');
const ABILITIES_PER_ROW = cn('grid', 'w-fit', 'grid-cols-3', 'gap-0.5');
const GEAR_PER_ROW = cn('grid', 'w-fit', 'grid-cols-4', 'gap-0.5');

/** The icon groups inside a card carry their own tooltip triggers. A click on one is about that
 *  icon, not about picking the hero. */
function stopCardActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function RosterCards({
  rows,
  shown,
  selectedId,
  onSelectHeroId,
  statLabel,
  sort,
  filter,
  actions,
}: {
  /** The whole roster — what the ability filter is offered against. */
  rows: readonly RosterHeroRow[];
  /** What survived the filter, in the chosen order. */
  shown: readonly RosterHeroRow[];
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  statLabel: (key: SheetKey) => string;
  sort: RosterSort;
  filter: RosterBoardFilter;
  actions: {
    onSort: (next: RosterSort) => void;
    onFilter: (next: RosterBoardFilter) => void;
  };
}) {
  const t = useCopy();
  const { lang } = useLocale();

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
        <BoardToolbar rows={rows} sort={sort} filter={filter} actions={actions} />
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <ul
          className="m-0 grid list-none justify-start gap-2.5 p-0"
          style={{ gridTemplateColumns: `repeat(auto-fill, ${CARD_WIDTH})` }}
          aria-label={t.heroesRosterListLabel}
        >
          {shown.map((row, index) => (
            <HeroCard
              key={row.id}
              row={row}
              lang={lang}
              selected={row.id === selectedId}
              index={index}
              onSelectHeroId={onSelectHeroId}
              statLabel={statLabel}
            />
          ))}
        </ul>
      </Tooltip.Provider>
    </Panel>
  );
}

/**
 * What the board is ordered by, whether shelved heroes are on it, and which abilities it is
 * narrowed to.
 *
 * The sort pair is the Inventory's own control — a key and a direction sharing one outline — for
 * the same reason the layout glyphs are: one shape, one meaning, wherever this app sorts a grid.
 */
function BoardToolbar({
  rows,
  sort,
  filter,
  actions,
}: {
  rows: readonly RosterHeroRow[];
  sort: RosterSort;
  filter: RosterBoardFilter;
  actions: {
    onSort: (next: RosterSort) => void;
    onFilter: (next: RosterBoardFilter) => void;
  };
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const ascending = sort.direction === 'asc';
  const options = useMemo(
    () => abilityFilterOptions(rows, filter.abilityIds),
    [rows, filter.abilityIds],
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2.5">
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted">
        <Switch
          checked={filter.hideDisabled}
          onCheckedChange={(next) => {
            actions.onFilter({ ...filter, hideDisabled: next });
          }}
          aria-label={t.heroesBoardHideDisabled}
        />
        {t.heroesBoardHideDisabled}
      </label>
      <span className={inventorySortGroupClass}>
        <Select
          size="compact"
          value={sort.key}
          onChange={(event) => {
            actions.onSort({ ...sort, key: event.target.value as RosterSortKey });
          }}
          aria-label={t.heroesBoardSortLabel}
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
            aria-label={ascending ? t.heroesBoardSortAscending : t.heroesBoardSortDescending}
            className={inventorySortDirectionClass}
          >
            <Icon name={ascending ? 'sort-ascending' : 'sort-descending'} size="sm" />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup>
                <p className="m-0 text-xs text-ink">
                  {ascending ? t.heroesBoardSortAscending : t.heroesBoardSortDescending}
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
 * empties the board is not an answer, and their presence is itself the answer to "which of these
 * do I have none of", which a list of only what you own cannot give.
 */
function AbilityFilterStrip({
  options,
  filter,
  lang,
  onFilter,
}: {
  options: readonly { id: string; owned: boolean; selected: boolean }[];
  filter: RosterBoardFilter;
  lang: Lang;
  onFilter: (next: RosterBoardFilter) => void;
}) {
  const t = useCopy();

  return (
    <span
      role="group"
      aria-label={t.heroesBoardAbilityFilterLabel}
      className={cn('flex', 'flex-wrap', 'items-center', 'gap-0.5')}
    >
      {options.map((option) => {
        const name = abilityName(option.id, lang);
        const label = option.owned
          ? sub(t.heroesBoardAbilityFilterOption, { ability: name })
          : sub(t.heroesBoardAbilityFilterAbsent, { ability: name });
        return (
          <Tooltip.Root key={option.id}>
            <Tooltip.Trigger
              type="button"
              aria-pressed={option.selected}
              aria-label={label}
              disabled={!option.owned}
              data-testid={`heroes-ability-filter-${option.id}`}
              onClick={() => {
                onFilter({ ...filter, abilityIds: toggleAbility(filter.abilityIds, option.id) });
              }}
              className={cn(
                'rounded-sm',
                'border-0',
                'bg-transparent',
                'p-0',
                option.owned ? 'cursor-pointer' : cn('cursor-default', 'opacity-30', 'grayscale'),
                option.selected && 'outline-2 outline-offset-1 outline-accent',
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

/** Exhaustive by construction: a seventh sort key is a compile error here rather than a blank
 *  option in the menu. */
const SORT_KEY_LABEL: Record<RosterSortKey, CopyKey> = {
  roll: 'heroesBoardSortRoll',
  power: 'heroesBoardSortPower',
  level: 'heroesBoardSortLevel',
  rarity: 'heroesBoardSortRarity',
  rank: 'heroesBoardSortRank',
  stars: 'heroesBoardSortStars',
};

function toggleAbility(selected: readonly string[], abilityId: string): readonly string[] {
  return selected.includes(abilityId)
    ? selected.filter((id) => id !== abilityId)
    : [...selected, abilityId];
}

/**
 * Memoised for the reason the picker's row is: re-reading the account rebuilds the row array
 * while the hero objects keep their identity, so a shallow compare skips every card whose hero
 * and selection did not move. A board draws the whole roster at once, which is exactly the case
 * where that boundary pays.
 */
const HeroCard = memo(function HeroCard({
  row,
  lang,
  selected,
  index,
  onSelectHeroId,
  statLabel,
}: {
  row: RosterHeroRow;
  lang: Lang;
  selected: boolean;
  index: number;
  onSelectHeroId: (heroId: string) => void;
  statLabel: (key: SheetKey) => string;
}) {
  const t = useCopy();
  const { hero } = row;
  // A hero taken out of the rotation is still on the board — greyed rather than hidden, so it can
  // be compared with the ones that are in. The mute rides on the contents, never on the card's
  // own border, which is what says which hero is selected.
  const inactiveChrome = hero.battleAllowed === false ? rosterInactiveChromeClass : undefined;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.24,
        ease: 'easeOut',
        delay: Math.min(index, CARD_STAGGER_CAP) * CARD_STAGGER_SECONDS,
      }}
      data-testid={`heroes-roster-card-${row.id}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      aria-label={hero.name}
      onClick={() => {
        onSelectHeroId(row.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectHeroId(row.id);
        }
      }}
      // One utility per string, as the roster rail's own row writes them: the copy guard reads a
      // space between two words as player-facing prose, and `cn()` arguments are not exempt from
      // it the way a bare `className=` is.
      className={cn(
        'flex',
        'min-w-0',
        'cursor-pointer',
        'flex-col',
        'gap-2.5',
        'rounded-sm',
        'border',
        'p-2.5',
        'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]',
        selected ? 'border-accent' : 'border-line',
        selected
          ? 'bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]'
          : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]',
      )}
    >
      <div className={cn('flex', 'min-w-0', 'flex-1', 'flex-col', 'gap-2.5', inactiveChrome)}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {/* The primitive rather than the `HeroRecord` chip around it: at this width the
              trailing record id crowds the name out, and it identifies a hero the player is
              already looking at. */}
          <HeroIdentity
            name={hero.name}
            rank={hero.rank}
            rarityIdx={RARITIES.indexOf(hero.rarity)}
            stars={hero.stars}
            level={hero.level}
            skin={hero.skin}
            lang={lang}
          />
          {/* Two figures a player reads down a roster, and the sans face this app ships has no
              tabular figures — so the mono face is what keeps the digits in line. Power is
              compact (`617.210` → `617.2k`) because at this width the full figure is the widest
              thing on the card. */}
          <span className="flex shrink-0 flex-col items-end leading-none">
            <span className="font-mono text-sm font-bold tabular-nums text-muted">
              {rollQualityText(row, lang)}
            </span>
            <span className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
              {hero.power == null ? NOT_PLACED : formatCompactNumber(hero.power, lang)}
            </span>
          </span>
        </div>

        <RollStrip row={row} statLabel={statLabel} />

        <CardSection title={t.rosterColAbilities}>
          <HeroAbilityIcons
            abilities={hero.abilities}
            lang={lang}
            className={ABILITIES_PER_ROW}
          />
        </CardSection>

        {/* Pushed to the floor of the card. Cards in one row are the same height, so a hero
            whose abilities take two rows and one whose take a single row still line their gear
            up with each other rather than each starting wherever its own abilities ended. */}
        <CardSection title={t.rosterColGear} className="mt-auto">
          <HeroGearIcons
            loadout={hero.loadout}
            lang={lang}
            className={GEAR_PER_ROW}
            emptySlotAriaLabel={(slotName) => sub(t.gearSlotEmptyAria, { slot: slotName })}
            emptySlotTip={t.gearSlotEmptyTip}
            lvLabel={t.importColLevel}
          />
        </CardSection>
      </div>
    </motion.li>
  );
});

function CardSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <h3 className="m-0 mb-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * The birth roll as eight bars — where each statistic landed inside its own rarity band, in the
 * order the sheet lists them.
 *
 * Bars rather than figures, because the figures are what the detail panel is for. What a card is
 * asked is "is this roll good, and good at what", and eight tinted lengths answer that in one look
 * where eight percentages have to be read one at a time. The exact reading is on each bar's
 * tooltip, so nothing is lost.
 */
function RollStrip({
  row,
  statLabel,
}: {
  row: RosterHeroRow;
  statLabel: (key: SheetKey) => string;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const statRows = statRollRowsFor(
    row.hero,
    (value) => formatNumber(value, lang, 2),
    (value) => `${formatNumber(value, lang, 1)}%`,
  );
  const byKey = new Map(statRows.map((statRow) => [statRow.key, statRow]));

  return (
    <div
      className={ROLL_BARS_PER_ROW}
      role="group"
      aria-label={`${t.heroesRollQualityLabel} · ${row.hero.name}`}
    >
      {SHEET_PANEL_KEYS.map((key) => {
        const statRow = byKey.get(key);
        const percentile = statRow?.percentile;
        const label = statLabel(key);
        return (
          <Tooltip.Root key={key}>
            <Tooltip.Trigger
              type="button"
              tabIndex={-1}
              aria-label={`${label} ${statRow?.position ?? NOT_PLACED}`}
              className="flex cursor-default flex-col gap-0.5 border-0 bg-transparent p-0"
              onClick={stopCardActivation}
              onKeyDown={stopCardActivation}
            >
              <span className="h-1.5 w-full overflow-hidden bg-bg" aria-hidden="true">
                {percentile === undefined ? null : (
                  <span
                    className={cn('block h-full', TINT_CLASS[railTintFor(percentile)])}
                    style={{ width: `${String(percentile)}%` }}
                  />
                )}
              </span>
              <span className="truncate text-[9px] leading-none text-muted" aria-hidden="true">
                {label.slice(0, BAR_LABEL_CHARS)}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 font-semibold text-ink">{label}</p>
                  <p className="m-0 font-mono text-xs tabular-nums text-muted">
                    {statRow === undefined
                      ? NOT_PLACED
                      : `${statRow.value} · ${statRow.band} · ${statRow.position}`}
                  </p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </div>
  );
}
