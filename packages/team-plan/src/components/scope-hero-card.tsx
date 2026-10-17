'use client';

import { memo, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Button, Select, cn } from '@bombfarm/ui';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { HeroAvatar, heroPeekData, heroRankToneClass, rarityTextClass, useHeroPeekStats } from '@bombfarm/game-art';
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
  priority,
  onShiftPriority,
}: {
  hero: HeroRecord;
  scope: ScopeState;
  t: TeamPlanCopy;
  lang: Lang;
  onScope: (heroId: string, scope: ScopeState) => void;
  /** Render-only clone for DragOverlay — no sensors. */
  overlay?: boolean;
  /** This hero's place in the gearing order, when the board is in priority mode. */
  priority?: { rank: number; count: number } | undefined;
  onShiftPriority?: ((heroId: string, delta: number) => void) | undefined;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: hero.id,
    data: { type: 'hero', heroId: hero.id, scope },
    disabled: overlay,
  });
  // A drop target only while it has a place in the gearing order: dropping a card on it takes
  // that place. Everywhere else a drop lands on the column, as it always has.
  const { setNodeRef: setDropRef } = useDroppable({
    id: priorityCardDropId(hero.id),
    data: { type: 'hero', heroId: hero.id, scope },
    disabled: overlay || !priority,
  });
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setDropRef(node);
    },
    [setNodeRef, setDropRef],
  );
  const peekStats = useHeroPeekStats();
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
      ref={overlay ? undefined : setRefs}
      className={cn(
        'relative touch-manipulation rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1.5 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--line)_28%,transparent)]',
        !overlay && 'cursor-grab active:cursor-grabbing',
        isDragging && !overlay && 'opacity-30',
        overlay && 'cursor-grabbing shadow-lg ring-1 ring-accent',
        !battleAllowed && 'bg-[color-mix(in_oklch,var(--bg)_50%,transparent)]',
      )}
      aria-label={label}
      {...(overlay ? {} : { ...listeners, ...attributes })}
    >
      {priority ? (
        <span
          className="absolute -top-1.5 -left-1.5 z-10 inline-grid min-w-4 place-items-center rounded-sm bg-accent px-1 text-[10px] leading-4 font-black tabular-nums text-accent-ink"
          aria-label={sub(t.teamPlanPriorityRankAria, { rank: String(priority.rank) })}
          data-priority-rank={priority.rank}
        >
          {priority.rank}
        </span>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0" aria-hidden={overlay || undefined}>
          <HeroAvatar
            skin={hero.skin ?? 0}
            rarityIdx={rarIdx}
            size="md"
            name={hero.name}
            heroId={hero.sourceId ?? hero.id}
            peek={overlay ? undefined : { hero: heroPeekData(hero, peekStats(hero)), lang }}
          />
        </div>
        <div className={cn('min-w-0 flex-1', priority && onShiftPriority && !overlay && 'pr-4')}>
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
          {priority && onShiftPriority && !overlay ? (
            <PriorityArrows hero={hero} priority={priority} t={t} onShift={onShiftPriority} />
          ) : null}
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

const PRIORITY_CARD_PREFIX = 'priority-card:';

export function priorityCardDropId(heroId: string): string {
  return `${PRIORITY_CARD_PREFIX}${heroId}`;
}

export function isPriorityCardDropId(id: string): boolean {
  return id.startsWith(PRIORITY_CARD_PREFIX);
}

function stopDrag(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function PriorityArrows({
  hero,
  priority,
  t,
  onShift,
}: {
  hero: HeroRecord;
  priority: { rank: number; count: number };
  t: TeamPlanCopy;
  onShift: (heroId: string, delta: number) => void;
}) {
  return (
    <div className="absolute inset-y-0 right-0.5 flex flex-col justify-center" onPointerDown={stopDrag} onMouseDown={stopDrag} onKeyDown={stopDrag}>
      <Button
        type="button"
        variant="icon-action"
        className="h-5"
        disabled={priority.rank === 1}
        aria-label={sub(t.teamPlanPriorityMoveUpAria, { name: hero.name })}
        onClick={() => onShift(hero.id, -1)}
      >
        <span aria-hidden className="text-[11px] leading-none">▲</span>
      </Button>
      <Button
        type="button"
        variant="icon-action"
        className="h-5"
        disabled={priority.rank === priority.count}
        aria-label={sub(t.teamPlanPriorityMoveDownAria, { name: hero.name })}
        onClick={() => onShift(hero.id, 1)}
      >
        <span aria-hidden className="text-[11px] leading-none">▼</span>
      </Button>
    </div>
  );
}
