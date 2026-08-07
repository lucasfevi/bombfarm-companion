'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@bombfarm/ui';
import type { HeroRecord } from '@/shared/lib/storage';
import type { ScopeState } from '@/shared/stores/gear-plan/types';
import type { Lang, Strings } from '@/shared/i18n';
import { ScopeHeroCard } from './scope-hero-card';

export function ScopeColumn({
  scope,
  title,
  tip,
  heroes,
  scopeByHeroId,
  t,
  lang,
  onScope,
}: {
  scope: ScopeState;
  title: string;
  tip: string;
  heroes: HeroRecord[];
  scopeByHeroId: Record<string, ScopeState>;
  t: Strings;
  lang: Lang;
  onScope: (heroId: string, scope: ScopeState) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: scope });

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        'flex min-h-40 min-w-0 flex-col rounded-sm border border-line bg-[color-mix(in_oklch,var(--bg)_35%,transparent)]',
        isOver && 'border-accent/70 bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]',
      )}
    >
      <header className="border-b border-line px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="m-0 text-[13px] font-bold tracking-wide text-ink uppercase">{title}</h3>
          <span className="text-[11px] tabular-nums text-muted">{heroes.length}</span>
        </div>
        <p className="m-0 mt-1 text-[11px] leading-snug text-muted">{tip}</p>
      </header>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto p-2">
        {heroes.length === 0 ? (
          <p className="m-0 px-1 py-3 text-center text-[11px] text-muted">{t.gearPlanScopeColumnEmpty}</p>
        ) : (
          heroes.map((hero) => (
            <ScopeHeroCard
              key={hero.id}
              hero={hero}
              scope={scopeByHeroId[hero.id] ?? scope}
              t={t}
              lang={lang}
              onScope={(next) => onScope(hero.id, next)}
            />
          ))
        )}
      </div>
    </section>
  );
}
