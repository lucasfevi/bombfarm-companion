'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Panel, Tooltip, panelHClass, panelTitleClass } from '@bombfarm/ui';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '@bombfarm/hero/copy';
import type { ScopeState } from '../core/hero-scope';
import type { TeamPlanCopy } from '../copy';
import { groupHeroesByScope, resolveDropScope, SCOPE_COLUMNS } from '../model/scope-board';
import { ScopeColumn } from './scope-column';
import { ScopeHeroCard } from './scope-hero-card';

/** Render-only clone for DragOverlay — no sensors, so its Select never fires a scope change. */
function noopScope() {}

/** Prefer the column/card under the pointer; fall back to rect intersection for empty lanes. */
const scopeCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

export function ScopeList({
  t,
  lang,
  heroes,
  scopeByHeroId,
  onScope,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  heroes: readonly HeroRecord[];
  scopeByHeroId: Record<string, ScopeState>;
  onScope: (heroId: string, scope: ScopeState) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const { resolved: resolvedScope, byColumn } = useMemo(
    () => groupHeroesByScope(heroes, scopeByHeroId),
    [heroes, scopeByHeroId],
  );

  const optimizeCount = byColumn.optimize.length;
  const activeHero = activeId ? heroes.find((hero) => hero.id === activeId) : null;

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const heroId = String(event.active.id);
    const over = event.over;
    if (!over) return;
    const target = resolveDropScope(String(over.id), over.data.current, resolvedScope);
    if (!target) return;
    if ((resolvedScope[heroId] ?? 'optimize') === target) return;
    onScope(heroId, target);
  };

  const columnCopy = {
    optimize: { title: t.teamPlanScopeOptimize, tip: t.teamPlanScopeOptimizeTip },
    donate: { title: t.teamPlanScopeDonate, tip: t.teamPlanScopeDonateTip },
    leaveAlone: { title: t.teamPlanScopeLeaveAlone, tip: t.teamPlanScopeLeaveAloneTip },
  } as const;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanScopeSectionTitle}</h2>
      </div>
      <p className="m-0 mb-2 text-[12px] text-muted">{t.teamPlanScopeBoardTip}</p>
      {optimizeCount === 0 ? (
        <p className="m-0 mb-2 text-sm text-warn">{t.teamPlanScopeNothingInScope}</p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={scopeCollision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <Tooltip.Provider delay={200} closeDelay={80}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {SCOPE_COLUMNS.map((scope) => (
              <ScopeColumn
                key={scope}
                scope={scope}
                title={columnCopy[scope].title}
                tip={columnCopy[scope].tip}
                heroes={byColumn[scope]}
                scopeByHeroId={resolvedScope}
                t={t}
                lang={lang}
                onScope={onScope}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeHero ? (
              <div className="w-[min(100vw-2rem,13rem)]">
                <ScopeHeroCard
                  hero={activeHero}
                  scope={resolvedScope[activeHero.id] ?? 'optimize'}
                  t={t}
                  lang={lang}
                  onScope={noopScope}
                  overlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </Tooltip.Provider>
      </DndContext>
    </Panel>
  );
}
