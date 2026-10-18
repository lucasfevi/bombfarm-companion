'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn, InfoTip } from '@bombfarm/ui';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '@bombfarm/hero/copy';
import type { ScopeState } from '../core/hero-scope';
import type { TeamPlanCopy } from '../copy';
import { ScopeHeroCard } from './scope-hero-card';

function columnCopy(scope: ScopeState, t: TeamPlanCopy): { title: string; tip: string } {
  if (scope === 'optimize') return { title: t.teamPlanScopeOptimize, tip: t.teamPlanScopeOptimizeTip };
  if (scope === 'donate') return { title: t.teamPlanScopeDonate, tip: t.teamPlanScopeDonateTip };
  return { title: t.teamPlanScopeLeaveAlone, tip: t.teamPlanScopeLeaveAloneTip };
}

export function ScopeColumn({
  scope,
  heroes,
  scopeByHeroId,
  t,
  lang,
  onScope,
  priorityById,
  onShiftPriority,
}: {
  scope: ScopeState;
  heroes: HeroRecord[];
  scopeByHeroId: Record<string, ScopeState>;
  t: TeamPlanCopy;
  lang: Lang;
  onScope: (heroId: string, scope: ScopeState) => void;
  /** Each hero's place in the gearing order — set on the Optimize column in priority mode. */
  priorityById?: ReadonlyMap<string, { rank: number; count: number }>;
  onShiftPriority?: (heroId: string, delta: number) => void;
}) {
  const { title, tip } = columnCopy(scope, t);
  const { setNodeRef, isOver } = useDroppable({
    id: scope,
    data: { type: 'column', scope },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      data-scope-column={scope}
      className={cn(
        'flex min-h-56 min-w-0 flex-col rounded-sm border border-line bg-[color-mix(in_oklch,var(--bg)_35%,transparent)] transition-[border-color,background-color]',
        isOver && 'border-accent bg-[color-mix(in_oklch,var(--accent)_12%,transparent)]',
      )}
    >
      <header className="border-b border-line px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1">
            <h3 className="m-0 text-[13px] font-bold tracking-wide text-ink uppercase">{title}</h3>
            <InfoTip label={title} tip={tip} />
          </div>
          <span className="text-[11px] tabular-nums text-muted">{heroes.length}</span>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto p-2 md:grid-cols-2">
        {heroes.length === 0 ? (
          <p className="col-span-full m-0 flex min-h-24 items-center justify-center px-1 py-6 text-center text-[11px] text-muted md:col-span-2">
            {t.teamPlanScopeColumnEmpty}
          </p>
        ) : (
          heroes.map((hero) => (
            <ScopeHeroCard
              key={hero.id}
              hero={hero}
              scope={scopeByHeroId[hero.id] ?? scope}
              t={t}
              lang={lang}
              onScope={onScope}
              priority={priorityById?.get(hero.id)}
              onShiftPriority={onShiftPriority}
            />
          ))
        )}
      </div>
    </section>
  );
}
