'use client';

import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { shortHeroRecordId } from '@bombfarm/domain/shims/hero-identity';
import { HeroIdentity, type HeroIdentityVariant } from './hero-identity';

/** Compact avatar + rank/name/rarity/level·id block — the `ScopeHeroCard` identity, sized down for a row. */
export function HeroIdentityChip({
  hero,
  fallbackName,
  lang,
  variant = 'inline',
  nameTestId,
}: {
  hero: HeroRecord | undefined;
  fallbackName: string;
  lang: Lang;
  variant?: HeroIdentityVariant;
  /** `data-testid` on the element carrying the hero's own name, for a caller that needs one. */
  nameTestId?: string;
}) {
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
      shortId={shortHeroRecordId(hero)}
      lang={lang}
      variant={variant}
      nameTestId={nameTestId}
    />
  );
}
