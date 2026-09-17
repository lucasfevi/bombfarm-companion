'use client';

import type { ReactNode } from 'react';
import { SLOTS, type Loadout, type SheetStats } from '@bombfarm/domain/gear';
import { heroLevelLabel, peekLabel, rarityLabel, sheetStatShortLabel } from '@bombfarm/domain/game-labels';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { RARITIES, SHEET_PANEL_KEYS, SHEET_PCT_KEYS } from '@bombfarm/domain/planner-constants';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { cn, formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { AbilityIcon } from '../ability-icon';
import { emptyGearSlotRecipe, heroRankToneClass, rarityTextClass } from '../game-art.recipe';
import { HeroAvatar } from '../hero-avatar';
import { ItemIcon } from '../item-icon';
import { usePeek, type PeekSpec } from './use-peek';
import {
  peekHeadClass,
  peekNameClass,
  peekNameTextClass,
  peekPowerClass,
  peekPowerLabelClass,
  peekPowerValueClass,
  peekRowClass,
  peekRowsGridClass,
  peekRuleClass,
  peekStripClass,
  peekSubClass,
} from './peek.recipe';

/** `ArtFrame`'s own middle-of-the-road default (Raro), for a hero whose rarity is not yet known. */
const NEUTRAL_RARITY_IDX = 2;
const MAX_STARS = 3;

/**
 * What a hero's card can say. Every field past the name is optional because the screens that
 * draw a hero hold it to different depths: a live row knows a name, a skin and a rank; the roster
 * holds the whole record. A card says what it was handed and leaves out the rest.
 */
export type HeroPeekData = {
  name: string;
  rank?: string | undefined;
  rarityIdx?: number | undefined;
  stars?: number | undefined;
  level?: number | undefined;
  skin?: number | undefined;
  /** The geared sheet — the eight figures the sheet panel prints. */
  stats?: SheetStats | undefined;
  abilities?: Record<string, number> | undefined;
  loadout?: Loadout | undefined;
  power?: number | undefined;
};

/**
 * The whole record, as the card reads it. An import candidate is a record without an id yet,
 * and the card never prints one — a reader tells two Perrins apart by the sheet, not the id.
 */
export function heroPeekData(hero: Omit<HeroRecord, 'id' | 'updatedAt'>): HeroPeekData {
  return {
    name: hero.name,
    rank: hero.rank,
    rarityIdx: RARITIES.indexOf(hero.rarity),
    stars: hero.stars,
    level: hero.level,
    skin: hero.skin,
    stats: hero.gearedOverride,
    abilities: hero.abilities,
    loadout: hero.loadout,
    power: hero.power,
  };
}

export type HeroPeekProps = {
  hero: HeroPeekData;
  lang: Lang;
  children: ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
  stopRowActivation?: boolean | undefined;
};

const emptyGearSlotTileClass = emptyGearSlotRecipe({ size: 'xs' });

/**
 * The card a hero opens: rank, name and stars, tier and level, the geared sheet in two columns,
 * then the abilities and the gear as bare art — bare because a card is one level deep, always.
 * The gear strip is always the eight slots in order, an empty tile standing in for each one
 * with nothing in it, so a reader sees which slots are empty.
 */
export function HeroPeekCard({ hero, lang }: Pick<HeroPeekProps, 'hero' | 'lang'>) {
  const rarityIdx = hero.rarityIdx !== undefined && hero.rarityIdx >= 0 ? hero.rarityIdx : undefined;
  const rarityKey = rarityIdx === undefined ? undefined : RARITIES[rarityIdx];
  const stars = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars ?? 0)));
  const abilities = hero.abilities ? heroAbilityIconEntries(hero.abilities) : [];
  const loadout = hero.loadout;
  const level = hero.level === undefined ? null : heroLevelLabel(hero.level, lang);

  return (
    <div data-slot="hero-peek">
      <div className={cn(peekHeadClass, hero.power !== undefined && 'grid-cols-[auto_minmax(0,1fr)_auto]')}>
        <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarityIdx ?? NEUTRAL_RARITY_IDX} size="lg" name="" />
        <div className="min-w-0">
          <div className={peekNameClass}>
            {hero.rank?.trim() ? (
              <span className={cn('shrink-0 font-black tracking-tight', heroRankToneClass(hero.rank))}>
                {hero.rank.trim()}
              </span>
            ) : null}
            <span className={peekNameTextClass}>{hero.name}</span>
            {stars > 0 ? (
              <span className="shrink-0 text-[10px] tracking-tight text-rar-4" aria-hidden="true">
                {'★'.repeat(stars)}
              </span>
            ) : null}
          </div>
          <div className={peekSubClass}>
            {rarityKey !== undefined ? (
              <span className={cn('font-semibold', rarityTextClass(rarityIdx ?? NEUTRAL_RARITY_IDX) ?? 'text-muted')}>
                {rarityLabel(rarityKey, lang)}
              </span>
            ) : null}
            {rarityKey !== undefined && level !== null ? (
              <span className="text-muted" aria-hidden="true">
                ·
              </span>
            ) : null}
            {level !== null ? <span className="text-muted">{level}</span> : null}
          </div>
        </div>
        {hero.power !== undefined ? (
          <div className={peekPowerClass}>
            <span className={peekPowerLabelClass}>{peekLabel('power', lang)}</span>
            <span className={peekPowerValueClass}>{formatCompactNumber(hero.power, lang)}</span>
          </div>
        ) : null}
      </div>
      {hero.stats ? (
        <>
          <div className={peekRuleClass} />
          <div className={peekRowsGridClass}>
            {SHEET_PANEL_KEYS.map((key) => {
              const value = hero.stats?.[key] ?? 0;
              return (
                <div key={key} className={peekRowClass}>
                  <span className="min-w-0 truncate">{sheetStatShortLabel(key, lang)}</span>
                  <b>{SHEET_PCT_KEYS.has(key) ? `${formatNumber(value, lang, 1)}%` : formatCompactNumber(value, lang)}</b>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      {abilities.length > 0 || loadout ? (
        <>
          <div className={peekRuleClass} />
          <div className="flex flex-col gap-1.5">
            {abilities.length > 0 ? (
              <div className={peekStripClass}>
                {abilities.map(({ id }) => (
                  <AbilityIcon key={id} code={id} size="xs" />
                ))}
              </div>
            ) : null}
            {loadout ? (
              <div className={peekStripClass}>
                {SLOTS.map((slot) => {
                  const item = loadout[slot];
                  return item ? (
                    <ItemIcon key={slot} item={item} size="xs" showLevel={false} />
                  ) : (
                    <span key={slot} data-slot="empty-gear-slot" className={emptyGearSlotTileClass} aria-hidden="true" />
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** What `HeroAvatar` needs to open the card itself. */
export type HeroAvatarPeek = Pick<HeroPeekProps, 'hero' | 'lang' | 'className' | 'stopRowActivation'>;

export function heroPeekSpec({ hero, lang, className, stopRowActivation }: HeroAvatarPeek): PeekSpec {
  return { kind: 'hero', className, stopRowActivation, card: <HeroPeekCard hero={hero} lang={lang} /> };
}

/** Wraps something other than a `HeroAvatar` — a name, say — so hovering it opens {@link HeroPeekCard}. */
export function HeroPeek({ children, disabled, ...peek }: HeroPeekProps) {
  return usePeek(disabled ? undefined : heroPeekSpec(peek), children);
}
