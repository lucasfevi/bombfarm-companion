'use client';

import { Switch, cn } from '@bombfarm/ui';
import { HeroIdentityChip, rosterInactiveChromeClass } from '@bombfarm/game-art';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { sub, type FarmCopy, type Lang } from '../copy';
import type { FarmPoolEntry } from '../core';

type Props = {
  entries: FarmPoolEntry[];
  heroes: readonly HeroRecord[];
  onToggle: (heroId: string, enabled: boolean) => void;
  lang: Lang;
  t: FarmCopy;
};

/**
 * Composes `Switch` locally rather than importing `roster`'s `HeroActiveToggle`: that component
 * is bound to `battleAllowed` semantics and a cross-feature reach for it would need a new lint
 * allowlist entry for a control whose meaning here is different (estimation-local, never a save
 * write). `heroes` is a separate prop because `deriveFarmPoolEntries` stays a pure id/name/enabled
 * derivation — the full record is resolved here, as `FarmRespecHeroGrid` does.
 *
 * The cards tighten below a 64rem pool because at the desktop shell's 960px minimum the wide card
 * fits only three per row, and the fifth row of it pushes the whole ranking table below the fold.
 * The narrow card gives back most of its lost width as padding, so the identity inside it loses
 * 4px rather than 16. This keys off the pool's own width, not the viewport's: the two hosts give
 * it different measures at the same window size.
 */
export function FarmRotationPool({ entries, heroes, onToggle, lang, t }: Props) {
  if (entries.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t.farmRankingPoolLabel}
      data-testid="farm-pool"
      className="@container flex flex-col gap-2"
    >
      <span className="text-[11px] font-bold tracking-[0.03em] text-muted uppercase">
        {t.farmRankingPoolLabel}
      </span>
      <div className="flex flex-wrap gap-1.5 @5xl:gap-2">
        {entries.map((entry) => {
          const hero = heroes.find((candidate) => candidate.id === entry.heroId);
          return (
            <div
              key={entry.heroId}
              data-testid={`farm-pool-hero-${entry.heroId}`}
              className="flex w-52 shrink-0 items-center gap-2 rounded-sm border border-line bg-surface p-1.5 @5xl:w-56 @5xl:p-2"
            >
              <div className={cn('min-w-0 flex-1', !entry.enabled && rosterInactiveChromeClass)}>
                <HeroIdentityChip
                  hero={hero}
                  fallbackName={entry.heroName}
                  lang={lang}
                  variant="stacked"
                />
              </div>
              <Switch
                checked={entry.enabled}
                onCheckedChange={(checked) => onToggle(entry.heroId, checked)}
                aria-label={sub(t.farmRankingPoolHeroAria, { name: entry.heroName })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
