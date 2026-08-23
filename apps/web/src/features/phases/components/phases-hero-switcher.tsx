'use client';

import { useState } from 'react';
import { HiMiniArrowsRightLeft } from 'react-icons/hi2';
import { HeroPickerDialog } from '@/features/roster';
import { HeroAvatar, rarityTextClass } from '@/shared/game-art';
import { cn } from '@bombfarm/ui';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import type { Lang, Strings } from '@/shared/i18n';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@/shared/lib/storage';
import { MAX_STARS } from '@bombfarm/domain/gear';

type Props = {
  t: Strings;
  lang: Lang;
  heroes: HeroRecord[];
  hero: HeroRecord;
  formatNumber: (n: number, d?: number) => string;
  onSelectHero: (h: HeroRecord) => void;
};

/**
 * Compact identity control that opens the same Switch Hero dialog as the planner strip.
 */
export function PhasesHeroSwitcher({ t, lang, heroes, hero, formatNumber, onSelectHero }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const rarIdx = RARITIES.indexOf(hero.rarity);
  const rarTextClass = rarityTextClass(rarIdx) ?? 'text-muted';
  const starCount = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars ?? 0)));
  const rankMark = hero.rank?.trim() || '—';

  return (
    <>
      <button
        type="button"
        className="group mb-3 grid w-full max-w-xl cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 border border-line bg-[color-mix(in_oklch,var(--bg)_35%,var(--surface))] px-2.5 py-1.5 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--accent)_6%,var(--surface))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        onClick={() => setPickerOpen(true)}
        aria-label={t.heroStripSwitch}
      >
        <HeroAvatar
          skin={hero.skin ?? 0}
          rarityIdx={rarIdx}
          size="lg"
          name={hero.name}
          className="shrink-0"
        />

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                'shrink-0 text-xl leading-none font-black tracking-tight',
                hero.rank ? 'text-accent' : 'text-muted',
              )}
              aria-label={t.heroRank}
            >
              {rankMark}
            </span>
            <p className="min-w-0 truncate text-base leading-none font-bold text-ink" title={hero.name}>
              <span className={rarTextClass}>{hero.name}</span>
              {starCount > 0 ? (
                <span className="ml-1 text-[0.92em] tracking-tight text-rar-4" aria-hidden="true">
                  {'★'.repeat(starCount)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className={`shrink-0 text-[11px] leading-none font-bold ${rarTextClass}`}>
              {rarityLabel(hero.rarity, lang)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted">L{hero.level}</span>
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

      <HeroPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        heroes={heroes}
        heroId={hero.id}
        lang={lang}
        t={t}
        formatNumber={formatNumber}
        onSelectHero={onSelectHero}
      />
    </>
  );
}
