'use client';

import { HiMiniArrowsRightLeft } from 'react-icons/hi2';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { useAppLang } from '@/shared/context/app-lang';
import { cn } from '@bombfarm/ui';
import {
  usePlannerStore,
  selectHeroName,
  selectHeroRarity,
  selectHeroStars,
  selectHeroSourceId,
  selectHeroRank,
  selectHeroBattleAllowed,
  selectHeroSkin,
} from '@/shared/stores';
import { HeroActiveToggle } from '@/features/roster';
import { HeroAvatar, rarityTextClass } from '@/shared/game-art';
import { MAX_STARS } from '@bombfarm/domain/gear';

export function HeroStripIdentity({ onOpenPicker }: { onOpenPicker: () => void }) {
  const { t, lang } = useAppLang();

  const heroes = usePlannerStore((state) => state.heroes);
  const activeHeroId = usePlannerStore((state) => state.activeHeroId);
  const setHeroBattleAllowedOnHero = usePlannerStore((state) => state.setHeroBattleAllowedOnHero);
  const heroName = usePlannerStore(selectHeroName);
  const heroRank = usePlannerStore(selectHeroRank);
  const heroSourceId = usePlannerStore(selectHeroSourceId);
  const heroBattleAllowed = usePlannerStore(selectHeroBattleAllowed);
  const heroSkin = usePlannerStore(selectHeroSkin);
  const rarity = usePlannerStore(selectHeroRarity);
  const stars = usePlannerStore(selectHeroStars);

  const rarIdx = RARITIES.indexOf(rarity);
  const rarTextClass = rarityTextClass(rarIdx) ?? 'text-muted';
  const rankMark = heroRank?.trim() || '—';
  const starCount = Math.max(0, Math.min(MAX_STARS, Math.round(stars)));

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-stretch border-b border-line bg-[color-mix(in_oklch,var(--bg)_35%,var(--surface))] xl:border-r xl:border-b-0">
      <button
        type="button"
        className="group grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 border-0 bg-transparent px-2.5 py-1.5 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--accent)_6%,var(--surface))] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        onClick={onOpenPicker}
        aria-label={t.heroStripSwitch}
      >
        <HeroAvatar skin={heroSkin} rarityIdx={rarIdx} size="lg" name={heroName} className="shrink-0" />

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                'shrink-0 text-xl leading-none font-black tracking-tight',
                heroRank ? 'text-accent' : 'text-muted',
              )}
              aria-label={t.heroRank}
            >
              {rankMark}
            </span>
            <p className="min-w-0 truncate text-base leading-none font-bold text-ink" title={heroName}>
              {heroName}
              {starCount > 0 ? (
                <span className="ml-1 text-[0.92em] tracking-tight text-rar-4" aria-hidden="true">
                  {'★'.repeat(starCount)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className={`shrink-0 text-[11px] leading-none font-bold ${rarTextClass}`}>
              {rarityLabel(rarity, lang)}
            </span>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-1.5 self-stretch border-l border-line pl-2 text-muted transition-colors group-hover:text-accent"
          aria-hidden="true"
        >
          <HiMiniArrowsRightLeft size={14} className="shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="text-[8px] font-bold tracking-[0.08em] uppercase">{t.switchHeroShort}</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums">{heroes.length}</span>
          </div>
        </div>
      </button>

      {heroSourceId && activeHeroId ? (
        <div className="flex items-center border-l border-line px-2.5">
          <HeroActiveToggle
            battleAllowed={heroBattleAllowed}
            t={t}
            onCheckedChange={(checked) => setHeroBattleAllowedOnHero(activeHeroId, checked)}
          />
        </div>
      ) : null}
    </div>
  );
}
