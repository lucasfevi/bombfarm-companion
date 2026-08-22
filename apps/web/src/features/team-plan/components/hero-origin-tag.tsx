'use client';

import { RARITIES } from '@bombfarm/domain/planner-constants';
import { cn } from '@bombfarm/ui';
import { rarityTextClass } from '@/shared/game-art';
import type { HeroRecord } from '@/shared/lib/storage';
import { MAX_STARS } from '@bombfarm/domain/gear';

/** `{rarityColor}Name ★★★ Lv {level}` — condensed hero identity for a card's "From" line. */
export function HeroOriginTag({
  heroId,
  heroByScopeKey,
  heroNameFallback,
  inventoryLabel,
}: {
  heroId: string | null;
  heroByScopeKey: Map<string, HeroRecord>;
  heroNameFallback: (heroId: string) => string;
  inventoryLabel: string;
}) {
  if (!heroId) return <span className="text-ink">{inventoryLabel}</span>;
  const hero = heroByScopeKey.get(heroId);
  if (!hero) return <span className="text-ink">{heroNameFallback(heroId)}</span>;

  const rarIdx = RARITIES.indexOf(hero.rarity);
  const stars = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars ?? 0)));

  return (
    <span>
      <span className={cn('font-semibold', rarityTextClass(rarIdx) ?? 'text-ink')}>{hero.name}</span>
      {stars > 0 ? <span className="text-rar-4"> {'★'.repeat(stars)}</span> : null}
      <span> Lv {hero.level}</span>
    </span>
  );
}
