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
import { memo, type ReactNode, type SyntheticEvent } from 'react';
import { motion } from 'motion/react';
import { SHEET_PANEL_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { HeroAbilityIcons, HeroGearIcons, HeroIdentityChip } from '@bombfarm/game-art';
import { railTintFor, statRollRowsFor, type RollTint } from '@bombfarm/hero/model';
import {
  Panel,
  Tooltip,
  cn,
  formatNumber,
  panelHClass,
  panelTitleClass,
  type Lang,
} from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { rollQualityText, type RosterHeroRow } from './hero-roster-order';

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

/** Three letters tell eight bars apart once the tooltip carries the full name, and it is what
 *  keeps the strip legible at an eighth of a card's width. */
const BAR_LABEL_CHARS = 3;

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
}: {
  rows: readonly RosterHeroRow[];
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  statLabel: (key: SheetKey) => string;
}) {
  const t = useCopy();
  const { lang } = useLocale();

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
          {t.heroesRollQualityLabel}
        </span>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <ul
          className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 min-[760px]:grid-cols-2 min-[1500px]:grid-cols-3 min-[1960px]:grid-cols-4"
          aria-label={t.heroesRosterListLabel}
        >
          {rows.map((row, index) => (
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
      <div className="flex min-w-0 items-center justify-between gap-2">
        <HeroIdentityChip hero={hero} fallbackName={hero.name} lang={lang} />
        {/* Roll quality is the figure a player reads down a roster, and the sans face this app
            ships has no tabular figures — so the mono face is what keeps the digits in line. */}
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-muted">
          {rollQualityText(row, lang)}
        </span>
      </div>

      <RollStrip row={row} statLabel={statLabel} />

      <CardSection title={t.rosterColAbilities}>
        <HeroAbilityIcons abilities={hero.abilities} lang={lang} />
      </CardSection>

      <CardSection title={t.rosterColGear}>
        <HeroGearIcons
          loadout={hero.loadout}
          lang={lang}
          className="flex-wrap"
          emptySlotAriaLabel={(slotName) => sub(t.gearSlotEmptyAria, { slot: slotName })}
          emptySlotTip={t.gearSlotEmptyTip}
          lvLabel={t.importColLevel}
        />
      </CardSection>
    </motion.li>
  );
});

function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
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
      className="grid grid-cols-8 gap-1"
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
