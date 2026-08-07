'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@bombfarm/ui';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { HeroAvatar, rarityTextClass } from '@/shared/game-art';
import type { HeroRecord } from '@/shared/lib/storage';
import type { ScopeState } from '@/shared/stores/gear-plan/types';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';

const SCOPE_OPTIONS: ScopeState[] = ['optimize', 'donate', 'leaveAlone'];

function scopeLabel(scope: ScopeState, strings: Strings): string {
  if (scope === 'optimize') return strings.gearPlanScopeOptimize;
  if (scope === 'donate') return strings.gearPlanScopeDonate;
  return strings.gearPlanScopeLeaveAlone;
}

export function ScopeHeroCard({
  hero,
  scope,
  t,
  lang,
  onScope,
}: {
  hero: HeroRecord;
  scope: ScopeState;
  t: Strings;
  lang: Lang;
  onScope: (scope: ScopeState) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: hero.id,
    data: { heroId: hero.id, scope },
  });
  const rarIdx = RARITIES.indexOf(hero.rarity);
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars ?? 0)));
  const battleAllowed = hero.battleAllowed ?? true;
  const shortId = shortHeroRecordId(hero);
  const label = sub(t.gearPlanHeroRowLabel, {
    name: hero.name,
    level: String(hero.level),
    id: shortId,
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        'touch-manipulation rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1.5 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--line)_28%,transparent)]',
        isDragging && 'opacity-80 ring-1 ring-accent',
        !battleAllowed && 'bg-[color-mix(in_oklch,var(--bg)_50%,transparent)]',
      )}
      aria-label={label}
      title={hero.sourceId ?? hero.id}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded-sm border-0 bg-transparent p-0 active:cursor-grabbing"
          aria-label={t.gearPlanScopeDragHandleAria}
          {...listeners}
          {...attributes}
        >
          <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarIdx} size="md" name={hero.name} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span
              className={cn(
                'text-base leading-none font-black tracking-tight',
                hero.rank?.trim() ? 'text-accent' : 'text-muted',
              )}
            >
              {hero.rank?.trim() || '—'}
            </span>
            <span className={cn('truncate text-sm leading-none font-bold', battleAllowed ? 'text-ink' : 'text-muted')}>
              {hero.name}
            </span>
            {stars > 0 ? (
              <span className="text-[0.85em] leading-none tracking-tight text-rar-4" aria-hidden>
                {'★'.repeat(stars)}
              </span>
            ) : null}
          </div>
          <div className={cn('mt-1 text-[12px] leading-none font-bold', rarityTextClass(rarIdx) ?? 'text-muted')}>
            {rarityLabel(hero.rarity, lang)}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] leading-none text-muted">
            <span>L{hero.level}</span>
            <span aria-hidden>·</span>
            <span>#{shortId}</span>
          </div>
          {!battleAllowed ? (
            <p className="m-0 mt-1 text-[10px] leading-snug text-muted">{t.gearPlanScopeDonateHint}</p>
          ) : null}
          <label className="mt-2 block">
            <span className="sr-only">{label}</span>
            <select
              className="w-full rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface-2)_70%,transparent)] px-1.5 py-1 text-[11px] text-ink"
              value={scope}
              aria-label={label}
              onChange={(event) => onScope(event.target.value as ScopeState)}
            >
              {SCOPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {scopeLabel(option, t)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </article>
  );
}
