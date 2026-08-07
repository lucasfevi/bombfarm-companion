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
import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { usePlannerStore, selectHeroes, selectScopeByHeroId } from '@/shared/stores';
import type { ScopeState } from '@/shared/stores/gear-plan/types';
import { defaultScopeForHero } from '@/shared/stores/gear-plan/types';
import { ScopeColumn } from './scope-column';
import { ScopeHeroCard } from './scope-hero-card';

const COLUMNS: ScopeState[] = ['optimize', 'donate', 'leaveAlone'];

function isScopeState(value: string): value is ScopeState {
  return value === 'optimize' || value === 'donate' || value === 'leaveAlone';
}

/** Prefer the column/card under the pointer; fall back to rect intersection for empty lanes. */
const scopeCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

function resolveDropScope(
  overId: string,
  overData: unknown,
  scopeByHeroId: Record<string, ScopeState>,
): ScopeState | null {
  if (overData && typeof overData === 'object') {
    const data = overData as { type?: unknown; scope?: unknown };
    if (data.type === 'column' && typeof data.scope === 'string' && isScopeState(data.scope)) {
      return data.scope;
    }
    if (data.type === 'hero' && typeof data.scope === 'string' && isScopeState(data.scope)) {
      return data.scope;
    }
  }
  if (isScopeState(overId)) return overId;
  return scopeByHeroId[overId] ?? null;
}

export function ScopeList({ t, lang }: { t: Strings; lang: Lang }) {
  const heroes = usePlannerStore(selectHeroes);
  const scopeByHeroId = usePlannerStore(selectScopeByHeroId);
  const setScope = usePlannerStore((state) => state.setScope);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const resolvedScope = useMemo(() => {
    const map: Record<string, ScopeState> = {};
    for (const hero of heroes) {
      map[hero.id] = scopeByHeroId[hero.id] ?? defaultScopeForHero(hero.battleAllowed);
    }
    return map;
  }, [heroes, scopeByHeroId]);

  const byColumn = useMemo(() => {
    const groups: Record<ScopeState, typeof heroes> = {
      optimize: [],
      donate: [],
      leaveAlone: [],
    };
    for (const hero of heroes) {
      groups[resolvedScope[hero.id] ?? 'optimize'].push(hero);
    }
    return groups;
  }, [heroes, resolvedScope]);

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
    setScope(heroId, target);
  };

  const columnCopy = {
    optimize: { title: t.gearPlanScopeOptimize, tip: t.gearPlanScopeOptimizeTip },
    donate: { title: t.gearPlanScopeDonate, tip: t.gearPlanScopeDonateTip },
    leaveAlone: { title: t.gearPlanScopeLeaveAlone, tip: t.gearPlanScopeLeaveAloneTip },
  } as const;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanScopeSectionTitle}</h2>
      </div>
      <p className="m-0 mb-2 text-[12px] text-muted">{t.gearPlanScopeBoardTip}</p>
      {optimizeCount === 0 ? (
        <p className="m-0 mb-2 text-sm text-warn">{t.gearPlanScopeNothingInScope}</p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={scopeCollision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {COLUMNS.map((scope) => (
            <ScopeColumn
              key={scope}
              scope={scope}
              title={columnCopy[scope].title}
              tip={columnCopy[scope].tip}
              heroes={byColumn[scope]}
              scopeByHeroId={resolvedScope}
              t={t}
              lang={lang}
              onScope={setScope}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeHero ? (
            <div className="w-[min(100vw-2rem,16rem)]">
              <ScopeHeroCard
                hero={activeHero}
                scope={resolvedScope[activeHero.id] ?? 'optimize'}
                t={t}
                lang={lang}
                onScope={() => {}}
                overlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Panel>
  );
}
