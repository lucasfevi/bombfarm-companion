'use client';

/**
 * The roster as a board of cards, one per hero, instead of a rail of names.
 *
 * The rail answers "who am I looking at"; the board answers "how does this hero compare to the
 * rest of them" — every hero's power, birth roll as bars, ability pool and gear side by side,
 * without clicking through the roster one at a time. That is why it takes the whole screen rather
 * than living in the 19rem column: eight roll bars and sixteen icons do not fit in a rail, and
 * shrunk until they do they stop being readable, which is the only thing this view is for.
 *
 * How much of that a card draws is the board's own three-way setting, `cardSectionsFor`: the
 * compact preset is what puts a whole roster on one screen, and the combat one is the full card
 * with the gear left off.
 *
 * Read-only. A card selects a hero and changes nothing.
 */
import { memo, useMemo, type ReactNode, type SyntheticEvent } from 'react';
import { motion } from 'motion/react';
import { RARITIES, SHEET_PANEL_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { heroGearedSheet } from '@bombfarm/domain/power';
import {
  HeroAbilityIcons,
  HeroGearIcons,
  HeroIdentity,
  rosterInactiveChromeClass,
} from '@bombfarm/game-art';
import {
  Panel,
  SegmentedToggle,
  Tooltip,
  cn,
  formatCompactNumber,
  formatNumber,
  panelHClass,
  panelTitleClass,
} from '@bombfarm/ui';
import { sub, type Lang, type RosterBoardCopy } from '../../copy';
import {
  ROSTER_CARD_DENSITIES,
  SHEET_PCT_KEYS,
  SHEET_STAT_CODES,
  cardSectionsFor,
  isRosterCardDensity,
  railTintFor,
  statRollRowsFor,
} from '../../model';
import type {
  RollTint,
  RosterCardAbilities,
  RosterCardDensity,
  RosterHeroRow,
} from '../../model';

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
/** All eight in one line once the labels under them are gone: a bar alone is narrow enough. */
const ROLL_BARS_UNLABELLED_PER_ROW = cn('grid', 'grid-cols-8', 'gap-1');
/** Small is six in one line — a Mythic's whole pool inside the card's content width. */
const ABILITIES_PER_ROW: Record<RosterCardAbilities['size'], string> = {
  lg: cn('grid', 'w-fit', 'grid-cols-3', 'gap-0.5'),
  xs: cn('grid', 'w-fit', 'grid-cols-6', 'gap-0.5'),
};
const GEAR_PER_ROW = cn('grid', 'w-fit', 'grid-cols-4', 'gap-0.5');
/** The eight figures over the labelled bar strip's four columns, in the strip's own order. */
const SHEET_STATS_PER_ROW = cn('grid', 'grid-cols-4', 'gap-1');

/** The icon groups inside a card carry their own tooltip triggers. A click on one is about that
 *  icon, not about picking the hero. */
function stopCardActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function RosterCards({
  rows,
  selectedId,
  onSelectHeroId,
  statLabel,
  density,
  onDensity,
  t,
  lang,
}: {
  /** Already filtered and ordered — the toolbar that did both sits above this panel. */
  rows: readonly RosterHeroRow[];
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  statLabel: (key: SheetKey) => string;
  /** The board's own, not the toolbar's: the list it shares that toolbar with has no density. */
  density: RosterCardDensity;
  onDensity: (next: RosterCardDensity) => void;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  const densityOptions = useMemo(
    () =>
      ROSTER_CARD_DENSITIES.map((id) => ({
        id,
        label: {
          compact: t.heroesDensityCompact,
          combat: t.heroesDensityCombat,
          full: t.heroesDensityFull,
        }[id],
      })),
    [t],
  );

  return (
    <Panel className="min-w-0">
      <div className={cn(panelHClass, 'items-center')}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
        <div data-testid="heroes-card-density">
          <SegmentedToggle
            options={densityOptions}
            value={density}
            onChange={(id) => {
              if (isRosterCardDensity(id)) onDensity(id);
            }}
            ariaLabel={t.heroesDensityLabel}
          />
        </div>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <ul
          className="m-0 grid list-none justify-start gap-2.5 p-0"
          style={{ gridTemplateColumns: `repeat(auto-fill, ${CARD_WIDTH})` }}
          aria-label={t.heroesRosterListLabel}
        >
          {rows.map((row, index) => (
            <HeroCard
              key={row.id}
              row={row}
              lang={lang}
              t={t}
              selected={row.id === selectedId}
              index={index}
              density={density}
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
 * Memoised for the reason the picker's row is: re-reading the account rebuilds the row array
 * while the hero objects keep their identity, so a shallow compare skips every card whose hero
 * and selection did not move. A board draws the whole roster at once, which is exactly the case
 * where that boundary pays.
 *
 * It is written out by hand rather than left to the React Compiler, which does not run over a
 * package a host lists in `transpilePackages` — so a component that reaches a host this way keeps
 * only the memoisation its own source spells.
 */
const HeroCard = memo(function HeroCard({
  row,
  lang,
  t,
  selected,
  index,
  density,
  onSelectHeroId,
  statLabel,
}: {
  row: RosterHeroRow;
  lang: Lang;
  t: RosterBoardCopy;
  selected: boolean;
  index: number;
  density: RosterCardDensity;
  onSelectHeroId: (heroId: string) => void;
  statLabel: (key: SheetKey) => string;
}) {
  const { hero } = row;
  const sections = cardSectionsFor(density);
  // A hero taken out of the rotation is still on the board — greyed rather than hidden, so it can
  // be compared with the ones that are in. The mute rides on the contents, never on the card's
  // own border, which is what says which hero is selected.
  const inactiveChrome = hero.battleAllowed === false ? rosterInactiveChromeClass : undefined;

  return (
    <motion.li
      // Deliberately NOT `layout`. A layout animation moves an element by transform-scaling it,
      // and a card is a box of fixed-size icons: they stretch with the box for the length of the
      // animation and snap back at the end. Re-ordering the board settles instantly instead.
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
        // Opaque, not transparent: cards fade over one another while the board is arriving, and
        // a see-through card shows the one behind it straight through its own gear.
        'bg-bg',
        selected ? 'border-accent' : 'border-line',
        selected
          ? 'bg-[color-mix(in_oklch,var(--accent)_10%,var(--bg))]'
          : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,var(--bg))]',
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
          {/* The one figure a player reads down a roster, and the sans face this app ships has
              no tabular figures — so the mono face is what keeps the digits in line. Compact
              (`617.210` → `617.2k`) because at this width the full figure is the widest thing on
              the card. The roll itself is the bars below, not a number: a mean of eight
              percentiles said less than the eight lengths do. */}
          <span className="flex shrink-0 flex-col items-end leading-none">
            <span className="font-mono text-[17px] font-bold tracking-tight tabular-nums text-ink">
              {hero.power == null ? NOT_PLACED : formatCompactNumber(hero.power, lang)}
            </span>
            <span className="mt-0.5 text-[9px] font-bold tracking-[0.08em] text-muted uppercase">
              {t.heroesSortPower}
            </span>
          </span>
        </div>

        <CardSection
          title={sections.roll.heading ? t.heroesCardBirthStatsLabel : undefined}
          testId="heroes-card-birth"
        >
          <RollStrip
            row={row}
            statLabel={statLabel}
            showLabels={sections.roll.labels}
            t={t}
            lang={lang}
          />
        </CardSection>

        {sections.sheetStats ? (
          <CardSection title={t.heroesCardSheetStatsLabel} testId="heroes-card-sheet">
            <SheetStats hero={hero} statLabel={statLabel} lang={lang} />
          </CardSection>
        ) : null}

        <CardSection
          title={sections.abilities.heading ? t.rosterColAbilities : undefined}
          testId="heroes-card-abilities"
        >
          <HeroAbilityIcons
            abilities={hero.abilities}
            lang={lang}
            size={sections.abilities.size}
            showLevel={sections.abilities.level}
            className={ABILITIES_PER_ROW[sections.abilities.size]}
          />
        </CardSection>

        {/* Pushed to the floor of the card. Cards in one row are the same height, so a hero
            whose abilities take two rows and one whose take a single row still line their gear
            up with each other rather than each starting wherever its own abilities ended. */}
        {sections.gear ? (
          <CardSection title={t.rosterColGear} className="mt-auto" testId="heroes-card-gear">
            <HeroGearIcons
              loadout={hero.loadout}
              lang={lang}
              className={GEAR_PER_ROW}
              emptySlotAriaLabel={(slotName) => sub(t.gearSlotEmptyAria, { slot: slotName })}
              emptySlotTip={t.gearSlotEmptyTip}
            />
          </CardSection>
        ) : null}
      </div>
    </motion.li>
  );
});

function CardSection({
  title,
  children,
  className,
  testId,
}: {
  /** Absent on a compact card's abilities: the icons explain themselves, and height is the point. */
  title: string | undefined;
  children: ReactNode;
  className?: string;
  testId: string;
}) {
  return (
    <div className={cn('min-w-0', className)} data-testid={testId}>
      {title === undefined ? null : (
        <h3 className="m-0 mb-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/**
 * The hero's own geared sheet, all eight stats in the bar strip's order — read through the same
 * door as its power, and nothing more: no auras, no phase, no derivation. What the game prints.
 */
function SheetStats({
  hero,
  statLabel,
  lang,
}: {
  hero: RosterHeroRow['hero'];
  statLabel: (key: SheetKey) => string;
  lang: Lang;
}) {
  const sheet = heroGearedSheet(hero);
  return (
    <div className={SHEET_STATS_PER_ROW}>
      {SHEET_PANEL_KEYS.map((key) => {
        const label = statLabel(key);
        const percent = SHEET_PCT_KEYS.has(key);
        const value = percent
          ? `${formatNumber(sheet[key], lang, 1)}%`
          : formatCompactNumber(sheet[key], lang);
        const exact = percent
          ? `${formatNumber(sheet[key], lang, 1)}%`
          : formatNumber(sheet[key], lang, 2);
        return (
          <Tooltip.Root key={key}>
            <Tooltip.Trigger
              type="button"
              tabIndex={-1}
              aria-label={`${label} ${exact}`}
              className="flex min-w-0 cursor-default flex-col items-start gap-0.5 border-0 bg-transparent p-0"
              onClick={stopCardActivation}
              onKeyDown={stopCardActivation}
            >
              <span className="text-[9px] leading-none text-muted" aria-hidden="true">
                {SHEET_STAT_CODES[key]}
              </span>
              <span
                className="font-mono text-[11px] leading-none tabular-nums text-ink"
                aria-hidden="true"
              >
                {value}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 font-semibold text-ink">{label}</p>
                  <p className="m-0 font-mono text-xs tabular-nums text-muted">{exact}</p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
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
 *
 * Without the codes under them the eight fit one row; the tooltip and each bar's own name still
 * say which is which, so a compact card loses nothing to a screen reader.
 */
function RollStrip({
  row,
  statLabel,
  showLabels,
  t,
  lang,
}: {
  row: RosterHeroRow;
  statLabel: (key: SheetKey) => string;
  showLabels: boolean;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  const statRows = statRollRowsFor(
    row.hero,
    (value) => formatNumber(value, lang, 2),
    (value) => `${formatNumber(value, lang, 1)}%`,
  );
  const byKey = new Map(statRows.map((statRow) => [statRow.key, statRow]));

  return (
    <div
      className={showLabels ? ROLL_BARS_PER_ROW : ROLL_BARS_UNLABELLED_PER_ROW}
      role="group"
      aria-label={`${t.heroesCardBirthStatsLabel} · ${row.hero.name}`}
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
              {showLabels ? (
                <span className="text-[9px] leading-none text-muted" aria-hidden="true">
                  {SHEET_STAT_CODES[key]}
                </span>
              ) : null}
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
