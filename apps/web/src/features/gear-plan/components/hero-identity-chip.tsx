'use client';

import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { cn } from '@bombfarm/ui';
import { HeroAvatar, rarityTextClass } from '@/shared/game-art';
import type { HeroRecord } from '@/shared/lib/storage';
import type { Lang } from '@/shared/i18n';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';

/** Compact avatar + rank/name/rarity/level·id block — the `ScopeHeroCard` identity, sized down for a row. */
export function HeroIdentityChip({
  hero,
  fallbackName,
  lang,
}: {
  hero: HeroRecord | undefined;
  fallbackName: string;
  lang: Lang;
}) {
  if (!hero) {
    return <span className="truncate text-[13px] font-bold text-ink">{fallbackName}</span>;
  }

  const rarIdx = RARITIES.indexOf(hero.rarity);
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars ?? 0)));
  const shortId = shortHeroRecordId(hero);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="shrink-0">
        <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarIdx} size="sm" name={hero.name} />
      </div>
      <div className="min-w-0 text-left">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span
            className={cn(
              'shrink-0 text-[13px] leading-none font-black tracking-tight',
              hero.rank?.trim() ? 'text-accent' : 'text-muted',
            )}
          >
            {hero.rank?.trim() || '—'}
          </span>
          <span className="truncate text-[13px] leading-none font-bold text-ink">{hero.name}</span>
          {stars > 0 ? (
            <span className="shrink-0 text-[10px] leading-none tracking-tight text-rar-4" aria-hidden>
              {'★'.repeat(stars)}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-none">
          <span className={cn('truncate font-bold', rarityTextClass(rarIdx) ?? 'text-muted')}>
            {rarityLabel(hero.rarity, lang)}
          </span>
          <span className="shrink-0 text-muted">
            L{hero.level}
            <span aria-hidden> · </span>#{shortId}
          </span>
        </div>
      </div>
    </div>
  );
}
