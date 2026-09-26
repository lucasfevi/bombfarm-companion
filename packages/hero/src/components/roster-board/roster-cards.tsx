'use client';

/**
 * The roster as a board of showcase cards, one per hero: who it is, its power, what it is built
 * for, how it was born, and the abilities and gear it carries — the card a player would show a
 * friend, rather than a dashboard of unlabelled figures.
 *
 * Read-only. A card selects a hero and changes nothing.
 */
import { memo, useMemo, type SyntheticEvent } from 'react';
import { motion } from 'motion/react';
import { abilityName, rarityLabel } from '@bombfarm/domain/game-labels';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import {
  AbilityIcon,
  HeroAvatar,
  HeroGearIcons,
  rarityTextClass,
  rosterInactiveChromeClass,
} from '@bombfarm/game-art';
import { Chip, Panel, Tooltip, cn, formatCompactNumber, panelHClass, panelTitleClass } from '@bombfarm/ui';
import { showcaseCopyFor, sub, type Lang, type RosterBoardCopy, type ShowcaseCopy } from '../../copy';
import {
  SHOWCASE_ABILITY_GAP_PX,
  SHOWCASE_CARD_MIN_WIDTH_PX,
  SHOWCASE_CARD_PADDING_PX,
  WIDE_BLAST_ABILITY_ID,
  averageItemLevelText,
  heroTypeLabel,
  percentText,
  showcaseCardReading,
  type RosterHeroRow,
  type ShowcaseCardReading,
} from '../../model';
import { BirthGradeLetter } from './birth-grade-letter';

/** Cards arrive in order rather than all at once, so the eye is led across the board. Capped, so
 *  a large roster does not spend seconds dealing itself out. `MotionConfig reducedMotion="user"`
 *  upstream turns all of it off for a reader who asked for that. */
const CARD_STAGGER_SECONDS = 0.022;
const CARD_STAGGER_CAP = 12;

const NOT_PLACED = '—';

const sectionLabelClass = 'mb-1.5 flex min-w-0 items-baseline justify-between gap-2 text-[11px] text-muted';

/** The icon groups inside a card carry their own hover cards. A click on one is about that icon,
 *  not about picking the hero. */
function stopCardActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function RosterCards({
  rows,
  selectedId,
  onSelectHeroId,
  t,
  lang,
}: {
  /** Already filtered and ordered — the toolbar that did both sits above this panel. */
  rows: readonly RosterHeroRow[];
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  const copy = showcaseCopyFor(lang);
  return (
    <Panel className="min-w-0">
      <div className={cn(panelHClass, 'items-center')}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
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
  onSelectHeroId,
}: {
  row: RosterHeroRow;
  lang: Lang;
  t: RosterBoardCopy;
  copy: ShowcaseCopy;
  selected: boolean;
  /** The card's place on the board as it is ordered now — the `#` in its corner. */
  index: number;
  onSelectHeroId: (heroId: string) => void;
}) {
  const { hero } = row;
  const reading = useMemo(() => showcaseCardReading(row, copy, lang), [row, copy, lang]);
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
      <div className={cn('flex', 'min-w-0', 'flex-1', 'flex-col', 'gap-3', inactiveChrome)}>
        <span
          className="absolute top-2.5 right-3 font-mono text-xs font-semibold text-muted"
          data-testid="heroes-card-position"
        >
          {sub(copy.cardPosition, { position: index + 1 })}
        </span>
        <CardHeader row={row} copy={copy} lang={lang} />
        <p className="m-0 flex items-baseline gap-1.5">
          <span className="font-mono text-[26px] leading-none font-bold tracking-tight tabular-nums text-ink">
            {hero.power == null ? NOT_PLACED : formatCompactNumber(hero.power, lang)}
          </span>
          <span className="text-[10px] font-bold tracking-[0.12em] text-muted uppercase">{copy.cardPower}</span>
        </p>
        <HeroTypeChips reading={reading} copy={copy} />
        <BirthLines row={row} reading={reading} copy={copy} lang={lang} />
        <div className="min-w-0" data-testid="heroes-card-abilities">
          <div className={sectionLabelClass}>
            <span>{copy.columnAbilities}</span>
            {reading.hasWideBlast ? (
              <span className="font-semibold text-gold" data-testid="heroes-card-wide-blast-label">
                {sub(copy.cardWideBlast, { ability: abilityName(WIDE_BLAST_ABILITY_ID, lang) })}
              </span>
            ) : null}
          </div>
          <ShowcaseAbilityIcons abilities={hero.abilities} lang={lang} />
        </div>
        {/* Pushed to the floor of the card, so cards in one row line their gear up however many
            lines the sections above took. */}
        <div className="mt-auto min-w-0" data-testid="heroes-card-gear">
          <div className={sectionLabelClass}>
            <span>{copy.columnGear}</span>
            <span className="truncate" data-testid="heroes-card-gear-average">
              {averageItemLevelText(reading.gear, copy, lang)}
            </span>
          </div>
          <HeroGearIcons
            loadout={hero.loadout}
            lang={lang}
            size="sm"
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

function BirthLines({
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
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="heroes-card-birth">
      <p className="m-0 flex items-center gap-2 text-xs text-muted">
        {grade ? <BirthGradeLetter grade={grade} copy={copy} testId="heroes-card-grade" /> : null}
        {reading.birthRollPct === undefined ? null : (
          <span>{sub(copy.cardBirthRoll, { pct: percentText(reading.birthRollPct, lang) })}</span>
        )}
      </p>
      {reading.highestRolls === undefined ? null : (
        <p className="m-0 text-xs text-muted">{reading.highestRolls}</p>
      )}
    </div>
  );
}

/**
 * A hero's ability pool as bare icons — the level is on each icon's hover card, not on the icon.
 * Wide Blast is ringed in gold and badged, since owning it at all is the point.
 */
function ShowcaseAbilityIcons({ abilities, lang }: { abilities: Record<string, number>; lang: Lang }) {
  const entries = heroAbilityIconEntries(abilities);
  if (entries.length === 0) return <span className="text-muted">{NOT_PLACED}</span>;
  return (
    <span
      className="flex flex-nowrap items-center"
      style={{ gap: SHOWCASE_ABILITY_GAP_PX }}
      onClick={stopCardActivation}
      onKeyDown={stopCardActivation}
    >
      {entries.map(({ id, level, max }) => {
        const icon = <AbilityIcon code={id} size="sm" peek={{ lang, level, max, stopRowActivation: true }} />;
        if (id !== WIDE_BLAST_ABILITY_ID) return <span key={id} className="inline-flex">{icon}</span>;
        return (
          <span
            key={id}
            className="relative inline-flex rounded-sm shadow-[0_0_0_2px_var(--gold),0_0_10px_1px_color-mix(in_oklch,var(--gold)_55%,transparent)]"
            data-testid="heroes-card-wide-blast"
          >
            {icon}
            <span
              className="pointer-events-none absolute -top-1.5 -right-1.5 grid size-3.5 place-items-center rounded-full bg-gold text-[9px] leading-none text-accent-ink"
              aria-hidden
            >
              ★
            </span>
          </span>
        );
      })}
    </span>
  );
}
