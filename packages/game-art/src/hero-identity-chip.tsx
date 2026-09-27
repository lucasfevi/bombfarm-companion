'use client';

import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { shortHeroRecordId } from '@bombfarm/domain/shims/hero-identity';
import { HeroIdentity, type HeroIdentityVariant } from './hero-identity';
import type { ArtFrameSize } from './art-frame';
import { heroPeekData, useHeroPeekStats } from './peek';

/** Compact avatar + rank/name/rarity/level·id block — the `ScopeHeroCard` identity, sized down for a row. */
export function HeroIdentityChip({
  hero,
  fallbackName,
  lang,
  variant = 'inline',
  size = 'sm',
  showId = true,
  nameTestId,
}: {
  hero: HeroRecord | undefined;
  fallbackName: string;
  lang: Lang;
  variant?: HeroIdentityVariant;
  /** Avatar frame size — `sm` (the `ScopeHeroCard` size) unless a caller sits the chip beside
   *  smaller art, e.g. an item icon, and wants to match it. */
  size?: ArtFrameSize;
  /** `false` drops the trailing `#<id>` — a caller identifying the hero by name and avatar alone,
   *  with no need for the record id a reader cannot act on. */
  showId?: boolean;
  /** `data-testid` on the element carrying the hero's own name, for a caller that needs one. */
  nameTestId?: string | undefined;
}) {
  const peekStats = useHeroPeekStats();
  if (!hero) {
    return (
      <span data-testid={nameTestId} className="truncate text-[13px] font-bold text-ink">
        {fallbackName}
      </span>
    );
  }

  return (
    <HeroIdentity
      name={hero.name}
      rank={hero.rank}
      rarityIdx={RARITIES.indexOf(hero.rarity)}
      stars={hero.stars}
      level={hero.level}
      skin={hero.skin}
      shortId={showId ? shortHeroRecordId(hero) : undefined}
      lang={lang}
      size={size}
      variant={variant}
      nameTestId={nameTestId}
      peek={heroPeekData(hero, peekStats(hero))}
    />
  );
}
