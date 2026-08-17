'use client';

import { useDraggable } from '@dnd-kit/core';
import { Select, cn } from '@bombfarm/ui';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { HeroAvatar, rarityTextClass } from '@/shared/game-art';
import type { HeroRecord } from '@/shared/lib/storage';
import type { ScopeState } from '@/shared/stores/team-plan/types';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { shortHeroRecordId } from '@/shared/lib/hero-identity';

const SCOPE_OPTIONS: ScopeState[] = ['optimize', 'donate', 'leaveAlone'];

function scopeLabel(scope: ScopeState, strings: Strings): string {
  if (scope === 'optimize') return strings.teamPlanScopeOptimize;
  if (scope === 'donate') return strings.teamPlanScopeDonate;
  return strings.teamPlanScopeLeaveAlone;
}

export function ScopeHeroCard({
  hero,
  scope,
  t,
  lang,
  onScope,
  overlay = false,
}: {
  hero: HeroRecord;
  scope: ScopeState;
  t: Strings;
  lang: Lang;
  onScope: (scope: ScopeState) => void;
  /** Render-only clone for DragOverlay — no sensors. */
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: hero.id,
    data: { type: 'hero', heroId: hero.id, scope },
    disabled: overlay,
  });
  const rarIdx = RARITIES.indexOf(hero.rarity);
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars ?? 0)));
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
          <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarIdx} size="md" name={hero.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span
              className={cn(
                'shrink-0 text-[15px] leading-none font-black tracking-tight',
                hero.rank?.trim() ? 'text-accent' : 'text-muted',
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
            <span className="shrink-0 text-muted">
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
                onChange={(event) => onScope(event.target.value as ScopeState)}
              >
                {SCOPE_OPTIONS.map((option) => (
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
}
