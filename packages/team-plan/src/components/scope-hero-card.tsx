'use client';

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Select, cn } from '@bombfarm/ui';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { HeroAvatar, heroPeekData, heroRankToneClass, rarityTextClass } from '@bombfarm/game-art';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { sub, type Lang } from '@bombfarm/hero/copy';
import { shortHeroRecordId } from '@bombfarm/domain/shims/hero-identity';
import { MAX_STARS } from '@bombfarm/domain/gear';
import type { ScopeState } from '../core/hero-scope';
import type { TeamPlanCopy } from '../copy';
import { SCOPE_COLUMNS } from '../model/scope-board';

function scopeLabel(scope: ScopeState, t: TeamPlanCopy): string {
  if (scope === 'optimize') return t.teamPlanScopeOptimize;
  if (scope === 'donate') return t.teamPlanScopeDonate;
  return t.teamPlanScopeLeaveAlone;
}

/**
 * It is written out by hand rather than left to the React Compiler, which does not run over a
 * package a host lists in `transpilePackages` — so a component that reaches a host this way keeps
 * only the memoisation its own source spells. One card per hero on the board: `onScope` takes
 * `(heroId, scope)` so the column passes the host's action by reference rather than building a
 * new closure per card, which is what keeps this boundary real.
 */
export const ScopeHeroCard = memo(function ScopeHeroCard({
  hero,
  scope,
  t,
  lang,
  onScope,
  overlay = false,
}: {
  hero: HeroRecord;
  scope: ScopeState;
  t: TeamPlanCopy;
  lang: Lang;
  onScope: (heroId: string, scope: ScopeState) => void;
  /** Render-only clone for DragOverlay — no sensors. */
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: hero.id,
    data: { type: 'hero', heroId: hero.id, scope },
    disabled: overlay,
  });
  const rarIdx = RARITIES.indexOf(hero.rarity);
  const stars = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars ?? 0)));
  const battleAllowed = hero.battleAllowed ?? true;
  const shortId = shortHeroRecordId(hero);
  const label = sub(t.teamPlanHeroRowLabel, {
    name: hero.name,
    level: String(hero.level),
    id: shortId,
  });

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      className={cn(
        'touch-manipulation rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1.5 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--line)_28%,transparent)]',
        !overlay && 'cursor-grab active:cursor-grabbing',
        isDragging && !overlay && 'opacity-30',
        overlay && 'cursor-grabbing shadow-lg ring-1 ring-accent',
        !battleAllowed && 'bg-[color-mix(in_oklch,var(--bg)_50%,transparent)]',
      )}
      aria-label={label}
      {...(overlay ? {} : { ...listeners, ...attributes })}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0" aria-hidden={overlay || undefined}>
          <HeroAvatar
            skin={hero.skin ?? 0}
            rarityIdx={rarIdx}
            size="md"
            name={hero.name}
            peek={overlay ? undefined : { hero: heroPeekData(hero), lang }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span
              className={cn(
                'shrink-0 text-[15px] leading-none font-black tracking-tight',
                heroRankToneClass(hero.rank),
              )}
            >
              {hero.rank?.trim() || '—'}
            </span>
            <span
              className={cn(
                'truncate text-[13px] leading-none font-bold',
                battleAllowed ? 'text-ink' : 'text-muted',
              )}
            >
              {hero.name}
            </span>
            {stars > 0 ? (
              <span className="shrink-0 text-[11px] leading-none tracking-tight text-rar-4" aria-hidden>
                {'★'.repeat(stars)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-none">
            <span className={cn('truncate font-bold', rarityTextClass(rarIdx) ?? 'text-muted')}>
              {rarityLabel(hero.rarity, lang)}
            </span>
            <span className="min-w-0 truncate text-muted">
              Lv {hero.level}
              <span aria-hidden> · </span>#{shortId}
            </span>
          </div>
          {!overlay ? (
            <div
              className="mt-1 md:hidden"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Select
                className="w-full"
                size="compact"
                value={scope}
                aria-label={label}
                onChange={(event) => onScope(hero.id, event.target.value as ScopeState)}
              >
                {SCOPE_COLUMNS.map((option) => (
                  <option key={option} value={option}>
                    {scopeLabel(option, t)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
});
