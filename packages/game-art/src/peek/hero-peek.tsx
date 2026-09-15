'use client';

import type { ReactNode } from 'react';
import { SLOTS, type Loadout, type SheetStats } from '@bombfarm/domain/gear';
import { heroLevelLabel, peekLabel, rarityLabel, sheetStatShortLabel } from '@bombfarm/domain/game-labels';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { RARITIES, SHEET_PANEL_KEYS, SHEET_PCT_KEYS } from '@bombfarm/domain/planner-constants';
import { shortHeroRecordId } from '@bombfarm/domain/shims/hero-identity';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { cn, formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { AbilityIcon } from '../ability-icon';
import { heroRankToneClass, rarityTextClass } from '../game-art.recipe';
import { HeroAvatar } from '../hero-avatar';
import { ItemIcon } from '../item-icon';
import { PeekFrame } from './peek-frame';
import {
  peekFootClass,
  peekHeadClass,
  peekNameClass,
  peekNameTextClass,
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
  shortId?: string | undefined;
  /** The geared sheet — the eight figures the sheet panel prints. */
  stats?: SheetStats | undefined;
  abilities?: Record<string, number> | undefined;
  loadout?: Loadout | undefined;
  power?: number | undefined;
  deployed?: boolean | undefined;
};

/**
 * The whole record, as the card reads it. An import candidate is a record without an id yet,
 * so the id is the one field allowed to be missing — the card then prints no `#id`.
 */
export function heroPeekData(hero: Omit<HeroRecord, 'id' | 'updatedAt'> & { id?: string }): HeroPeekData {
  const recordId = hero.sourceId ?? hero.id;
  return {
    name: hero.name,
    rank: hero.rank,
    rarityIdx: RARITIES.indexOf(hero.rarity),
    stars: hero.stars,
    level: hero.level,
    skin: hero.skin,
    shortId: recordId === undefined ? undefined : shortHeroRecordId({ id: recordId }),
    stats: hero.gearedOverride,
    abilities: hero.abilities,
    loadout: hero.loadout,
    power: hero.power,
    deployed: hero.deployed,
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

/**
 * The card a hero opens: rank, name and stars, tier and level, the geared sheet in two columns,
 * then the abilities and the gear as bare art — bare because a card is one level deep, always.
 */
export function HeroPeekCard({ hero, lang }: Pick<HeroPeekProps, 'hero' | 'lang'>) {
  const rarityIdx = hero.rarityIdx !== undefined && hero.rarityIdx >= 0 ? hero.rarityIdx : undefined;
  const rarityKey = rarityIdx === undefined ? undefined : RARITIES[rarityIdx];
  const stars = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars ?? 0)));
  const abilities = hero.abilities ? heroAbilityIconEntries(hero.abilities) : [];
  const loadout = hero.loadout;
  const gear = loadout ? SLOTS.flatMap((slot) => (loadout[slot] ? [loadout[slot]] : [])) : [];
  const subtitle = [
    hero.level === undefined ? null : heroLevelLabel(hero.level, lang),
    hero.shortId === undefined ? null : `#${hero.shortId}`,
  ].filter((part) => part !== null);

  return (
    <div data-slot="hero-peek">
      <div className={peekHeadClass}>
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
            {rarityKey !== undefined && subtitle.length > 0 ? (
              <span className="text-muted" aria-hidden="true">
                ·
              </span>
            ) : null}
            {subtitle.length > 0 ? <span className="text-muted">{subtitle.join(' · ')}</span> : null}
          </div>
        </div>
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
      {abilities.length > 0 || gear.length > 0 ? (
        <>
          <div className={peekRuleClass} />
          <div className="flex flex-col gap-1.5">
            {abilities.length > 0 ? (
              <div className={peekStripClass}>
                {abilities.map(({ id, level, max }) => (
                  <AbilityIcon key={id} code={id} size="sm" level={level} max={max} />
                ))}
              </div>
            ) : null}
            {gear.length > 0 ? (
              <div className={peekStripClass}>
                {gear.map((item) => (
                  <ItemIcon key={item.defId} item={item} size="xs" showLevel={false} />
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {hero.deployed || hero.power !== undefined ? (
        <div className={peekFootClass}>
          <span>{hero.deployed ? peekLabel('deployed', lang) : ''}</span>
          {hero.power !== undefined ? (
            <span className="shrink-0">
              {peekLabel('power', lang)} {formatCompactNumber(hero.power, lang)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Wraps a hero's avatar (or name) so hovering it opens {@link HeroPeekCard}. */
export function HeroPeek({ hero, lang, children, className, disabled, stopRowActivation }: HeroPeekProps) {
  return (
    <PeekFrame
      kind="hero"
      className={className}
      disabled={disabled}
      stopRowActivation={stopRowActivation}
      card={<HeroPeekCard hero={hero} lang={lang} />}
    >
      {children}
    </PeekFrame>
  );
}
