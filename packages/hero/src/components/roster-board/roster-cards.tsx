'use client';

/**
 * The roster as a board of showcase cards, one per hero: who it is, its power, what it is built
 * for, how it was born, and the abilities and gear it carries — the card a player would show a
 * friend, rather than a dashboard of unlabelled figures.
 *
 * Read-only. A card selects a hero and changes nothing.
 */
import { Fragment, memo, useMemo, type CSSProperties, type SyntheticEvent } from 'react';
import { motion } from 'motion/react';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import {
  ART_TILE_SIZE_VAR,
  AbilityIcon,
  HeroAvatar,
  HeroGearIcons,
  rarityTextClass,
  rosterInactiveChromeClass,
} from '@bombfarm/game-art';
import { Chip, Panel, Switch, Tooltip, cn, formatCompactNumber, panelHClass, panelTitleClass } from '@bombfarm/ui';
import { showcaseCopyFor, sub, type Lang, type RosterBoardCopy, type ShowcaseCopy } from '../../copy';
import {
  SHOWCASE_ABILITY_GAP_PX,
  SHOWCASE_CARD_MIN_WIDTH_PX,
  SHOWCASE_CARD_PADDING_PX,
  SHOWCASE_TILE_SIZE,
  WIDE_BLAST_ABILITY_ID,
  gearAverageFigures,
  heroTypeLabel,
  percentText,
  showcaseCardReading,
  showcaseTileWidthCss,
  type EquippedGearAverages,
  type RosterHeroRow,
  type ShowcaseCardReading,
  type ShowcaseView,
} from '../../model';
import { GradeLadder } from '../grade-rail';
import { RollRail } from '../roll-rail';
import { BirthGradeLetter } from './birth-grade-letter';

/** Cards arrive in order rather than all at once, so the eye is led across the board. Capped, so
 *  a large roster does not spend seconds dealing itself out. `MotionConfig reducedMotion="user"`
 *  upstream turns all of it off for a reader who asked for that. */
const CARD_STAGGER_SECONDS = 0.022;
const CARD_STAGGER_CAP = 12;

const NOT_PLACED = '—';

const sectionLabelClass = 'mb-1.5 flex min-w-0 items-baseline justify-between gap-2 text-[11px] text-muted';

const figureClass = 'font-mono text-xs font-semibold tabular-nums';

/** Both icon rows measure their tiles against their own width, so a wider card grows its tiles
 *  rather than leaving the rows short. */
const TILE_WIDTH_STYLE = { [ART_TILE_SIZE_VAR]: showcaseTileWidthCss() } as CSSProperties;

/** The icon groups inside a card carry their own hover cards. A click on one is about that icon,
 *  not about picking the hero. */
function stopCardActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function RosterCards({
  rows,
  selectedId,
  onSelectHeroId,
  view,
  onViewChange,
  t,
  lang,
}: {
  /** Already filtered and ordered — the toolbar that did both sits above this panel. */
  rows: readonly RosterHeroRow[];
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  view: ShowcaseView;
  onViewChange: (next: ShowcaseView) => void;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  const copy = showcaseCopyFor(lang);
  return (
    <Panel className="min-w-0">
      <div className={cn(panelHClass, 'items-center')}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
        <label
          data-testid="heroes-card-show-levels"
          className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted"
        >
          <Switch
            checked={view.showLevels}
            onCheckedChange={(showLevels) => {
              onViewChange({ ...view, showLevels });
            }}
            aria-label={copy.cardShowLevels}
          />
          {copy.cardShowLevels}
        </label>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <ul
          className="m-0 grid list-none gap-2.5 p-0"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${String(SHOWCASE_CARD_MIN_WIDTH_PX)}px, 1fr))` }}
          aria-label={t.heroesRosterListLabel}
        >
          {rows.map((row, index) => (
            <HeroCard
              key={row.id}
              row={row}
              lang={lang}
              t={t}
              copy={copy}
              selected={row.id === selectedId}
              index={index}
              showLevels={view.showLevels}
              onSelectHeroId={onSelectHeroId}
            />
          ))}
        </ul>
      </Tooltip.Provider>
    </Panel>
  );
}

/**
 * Memoised by hand: re-reading the account rebuilds the row array while the hero objects keep
 * their identity, so a shallow compare skips every card whose hero and selection did not move. The
 * React Compiler does not run over a package a host lists in `transpilePackages`.
 */
const HeroCard = memo(function HeroCard({
  row,
  lang,
  t,
  copy,
  selected,
  index,
  showLevels,
  onSelectHeroId,
}: {
  row: RosterHeroRow;
  lang: Lang;
  t: RosterBoardCopy;
  copy: ShowcaseCopy;
  selected: boolean;
  /** The card's place on the board as it is ordered now — the `#` in its corner. */
  index: number;
  showLevels: boolean;
  onSelectHeroId: (heroId: string) => void;
}) {
  const { hero } = row;
  const reading = useMemo(() => showcaseCardReading(row), [row]);
  // Muted on the contents, never on the card's own border, which is what says which is selected.
  const inactiveChrome = hero.battleAllowed === false ? rosterInactiveChromeClass : undefined;

  return (
    <motion.li
      // Deliberately NOT `layout`: a layout animation transform-scales the box, and a card of
      // fixed-size icons stretches with it for the length of the animation.
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
      // One utility per string: the copy guard reads a space between two words in a `cn()`
      // argument as player-facing prose.
      className={cn(
        'relative',
        'flex',
        'min-w-0',
        'cursor-pointer',
        'flex-col',
        'rounded-sm',
        'border',
        'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]',
        // Opaque: cards fade over one another while the board arrives.
        'bg-bg',
        selected ? 'border-accent' : 'border-line',
        selected
          ? 'bg-[color-mix(in_oklch,var(--accent)_10%,var(--bg))]'
          : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,var(--bg))]',
      )}
      style={{ padding: SHOWCASE_CARD_PADDING_PX }}
    >
      <div className={cn('flex', 'min-w-0', 'flex-1', 'flex-col', 'gap-3', inactiveChrome)} style={TILE_WIDTH_STYLE}>
        <span
          className="absolute top-2.5 right-3 font-mono text-xs font-semibold text-muted"
          data-testid="heroes-card-position"
        >
          {sub(copy.cardPosition, { position: index + 1 })}
        </span>
        <CardHeader row={row} copy={copy} lang={lang} />
        <p className="m-0 flex items-baseline gap-1.5">
          <span className="font-mono text-[26px] leading-none font-bold tracking-tight tabular-nums text-accent">
            {hero.power == null ? NOT_PLACED : formatCompactNumber(hero.power, lang)}
          </span>
          <span className="text-[10px] font-bold tracking-[0.12em] text-muted uppercase">{copy.cardPower}</span>
        </p>
        <HeroTypeChips reading={reading} copy={copy} />
        <BirthSection row={row} reading={reading} copy={copy} lang={lang} />
        <div className="@container min-w-0" data-testid="heroes-card-abilities">
          <div className={sectionLabelClass}>
            <span>{copy.columnAbilities}</span>
          </div>
          <ShowcaseAbilityIcons abilities={hero.abilities} lang={lang} showLevels={showLevels} />
        </div>
        {/* Pushed to the floor of the card, so cards in one row line their gear up however many
            lines the sections above took. */}
        <div className="@container mt-auto min-w-0" data-testid="heroes-card-gear">
          <div className={sectionLabelClass}>
            <span>{copy.columnGear}</span>
            <GearAverage gear={reading.gear} copy={copy} lang={lang} />
          </div>
          <HeroGearIcons
            loadout={hero.loadout}
            lang={lang}
            size={SHOWCASE_TILE_SIZE}
            showLevels={showLevels}
            emptySlotAriaLabel={(slotName) => sub(t.gearSlotEmptyAria, { slot: slotName })}
            emptySlotTip={t.gearSlotEmptyTip}
          />
        </div>
      </div>
    </motion.li>
  );
});

function CardHeader({ row, copy, lang }: { row: RosterHeroRow; copy: ShowcaseCopy; lang: Lang }) {
  const { hero } = row;
  const rarityIdx = RARITIES.indexOf(hero.rarity);
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars)));
  return (
    <div className="flex min-w-0 items-center gap-2.5 pr-8">
      <HeroAvatar skin={hero.skin ?? 0} rarityIdx={Math.max(0, rarityIdx)} size="md" name={hero.name} />
      <div className="min-w-0">
        <p className="m-0 flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[15px] leading-tight font-bold text-ink">{hero.name}</span>
          {stars > 0 ? (
            <span className="shrink-0 text-[11px] leading-none tracking-tight text-rar-4" aria-hidden>
              {'★'.repeat(stars)}
            </span>
          ) : null}
        </p>
        <p className="m-0 mt-1 truncate text-xs text-muted">
          <span className={cn('font-bold', rarityTextClass(rarityIdx))}>{rarityLabel(hero.rarity, lang)}</span>
          <span aria-hidden> · </span>
          {sub(copy.cardLevel, { level: hero.level })}
        </p>
      </div>
    </div>
  );
}

function HeroTypeChips({ reading, copy }: { reading: ShowcaseCardReading; copy: ShowcaseCopy }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1" data-testid="heroes-card-types">
      {reading.types.length === 0 ? (
        <Chip className="cursor-default px-2 py-0.5 text-muted">{copy.typeNone}</Chip>
      ) : (
        reading.types.map((type, position) => (
          <Chip
            key={type}
            variant={position === 0 ? 'on' : 'default'}
            className={cn('cursor-default', 'px-2', 'py-0.5', position === 0 ? 'text-ink' : 'text-muted')}
          >
            {heroTypeLabel(type, copy)}
          </Chip>
        ))
      )}
    </div>
  );
}

/**
 * How the hero was born, as meters: the grade and the mean roll on a small grade ladder, then the
 * two statistics that rolled closest to the top of their windows, each on the detail panel's rail.
 */
function BirthSection({
  row,
  reading,
  copy,
  lang,
}: {
  row: RosterHeroRow;
  reading: ShowcaseCardReading;
  copy: ShowcaseCopy;
  lang: Lang;
}) {
  const grade = row.hero.rank?.trim();
  const { birth, highestRolls } = reading;
  return (
    <div className="min-w-0" data-testid="heroes-card-birth">
      <div className={sectionLabelClass}>
        <span>{copy.cardBirthSection}</span>
        {highestRolls.length === 0 ? null : (
          <span className="truncate">
            {copy.cardHighestRollsHeading} · {copy.cardRollRangeHint}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[max-content_1fr_4ch] items-center gap-x-2 gap-y-1.5">
        <span className="flex items-baseline gap-1.5 text-[11px] whitespace-nowrap text-muted">
          {grade ? <BirthGradeLetter grade={grade} copy={copy} testId="heroes-card-grade" /> : null}
          <span>{copy.cardBirthOverall}</span>
        </span>
        {birth === undefined ? <span /> : <GradeLadder mean={birth.mean} railLetter={birth.railLetter} />}
        <span className={cn(figureClass, 'text-right', 'text-ink')} data-testid="heroes-card-birth-mean">
          {birth === undefined ? NOT_PLACED : percentText(birth.mean, lang)}
        </span>
        {highestRolls.map((roll) => (
          <Fragment key={roll.key}>
            <span className="text-xs whitespace-nowrap text-ink" data-testid="heroes-card-roll-stat">
              {copy.rollStat[roll.key]}
            </span>
            <RollRail percentile={roll.percentile} trackClassName="bg-line/60" />
            <span className={cn(figureClass, 'text-right', 'text-ink')}>{percentText(roll.percentile, lang)}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** "Avg Lv 124 · Forge +13": the words muted, the figures in the mono face — the level in ink and
 *  the forge in the accent, as the item tiles print a forge. */
function GearAverage({ gear, copy, lang }: { gear: EquippedGearAverages; copy: ShowcaseCopy; lang: Lang }) {
  const figures = gearAverageFigures(gear, lang);
  if (figures === undefined) {
    return (
      <span className="truncate" data-testid="heroes-card-gear-average">
        {copy.cardNothingEquipped}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-baseline gap-1 whitespace-nowrap" data-testid="heroes-card-gear-average">
      <span>{copy.cardGearAverage}</span>{' '}
      <span className={cn(figureClass, 'text-ink')}>{sub(copy.cardGearLevel, { level: figures.level })}</span>{' '}
      <span aria-hidden>·</span>{' '}
      <span>{copy.cardGearForge}</span>{' '}
      <span className={cn(figureClass, 'text-accent')}>+{figures.forge}</span>
    </span>
  );
}

/**
 * A hero's ability pool as icons, their levels printed over the art only when the board asks —
 * over it, so the switch never resizes the art. Wide Blast is ringed in gold and badged, since
 * owning it at all is the point; the ring and badge ride on the icon, so they lift with it.
 */
function ShowcaseAbilityIcons({
  abilities,
  lang,
  showLevels,
}: {
  abilities: Record<string, number>;
  lang: Lang;
  showLevels: boolean;
}) {
  const entries = heroAbilityIconEntries(abilities);
  if (entries.length === 0) return <span className="text-muted">{NOT_PLACED}</span>;
  return (
    <span
      className="flex flex-nowrap items-center"
      style={{ gap: SHOWCASE_ABILITY_GAP_PX }}
      onClick={stopCardActivation}
      onKeyDown={stopCardActivation}
    >
      {entries.map(({ id, level, max }) => (
        <AbilityIcon
          key={id}
          code={id}
          size={SHOWCASE_TILE_SIZE}
          {...(showLevels ? { level, max } : {})}
          levelPlacement="over-art"
          adornment={id === WIDE_BLAST_ABILITY_ID ? WIDE_BLAST_MARK : undefined}
          peek={{ lang, level, max, stopRowActivation: true }}
        />
      ))}
    </span>
  );
}

const WIDE_BLAST_MARK = (
  <>
    <span
      className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_0_0_2px_var(--gold),0_0_10px_1px_color-mix(in_oklch,var(--gold)_55%,transparent)]"
      aria-hidden
      data-testid="heroes-card-wide-blast"
    />
    <span
      className="pointer-events-none absolute -top-1.5 -right-1.5 grid size-3.5 place-items-center rounded-full bg-gold text-[9px] leading-none text-accent-ink"
      aria-hidden
      data-testid="heroes-card-wide-blast-badge"
    >
      ★
    </span>
  </>
);
