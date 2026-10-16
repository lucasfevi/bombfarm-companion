'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import { InfoTip, Panel, Tooltip, panelHClass, panelTitleClass } from '@bombfarm/ui';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '@bombfarm/hero/copy';
import type { ScopeState } from '../core/hero-scope';
import type { TeamPlanCopy } from '../copy';
import { groupHeroesByScope, resolveDropScope, SCOPE_COLUMNS } from '../model/scope-board';
import { movePriorityBefore, resolvePriorityOrder, shiftPriority } from '../core/priority-order';
import { ScopeColumn } from './scope-column';
import { isPriorityCardDropId, ScopeHeroCard } from './scope-hero-card';

/** Render-only clone for DragOverlay — no sensors, so its Select never fires a scope change. */
function noopScope() {}

/** The hero an Optimize card stands for, read off its drop data; `null` for anything else. */
function optimizeCardId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const card = data as { type?: unknown; heroId?: unknown; scope?: unknown };
  return card.type === 'hero' && card.scope === 'optimize' && typeof card.heroId === 'string' ? card.heroId : null;
}

/** Prefer the column/card under the pointer; fall back to rect intersection for empty lanes. */
const scopeCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  const cardHits = pointerHits.filter((hit) => isPriorityCardDropId(String(hit.id)));
  if (cardHits.length > 0) return cardHits;
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

export function ScopeList({
  t,
  lang,
  heroes,
  scopeByHeroId,
  onScope,
  priorityOrder,
  onPriorityOrder,
  headerAction,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  heroes: readonly HeroRecord[];
  scopeByHeroId: Record<string, ScopeState>;
  onScope: (heroId: string, scope: ScopeState) => void;
  /** The stored gearing order in priority mode; `null` while the board is team-wide. */
  priorityOrder: readonly string[] | null;
  onPriorityOrder: (order: readonly string[]) => void;
  /** Drawn at the right of the board's header — the screen puts the priority switch there. */
  headerAction?: ReactNode;
}) {
  const priorityMode = priorityOrder !== null;
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

  const order = useMemo(
    () => resolvePriorityOrder(heroes, scopeByHeroId, priorityOrder ?? []),
    [heroes, scopeByHeroId, priorityOrder],
  );
  const columns = useMemo(() => {
    if (!priorityMode) return byColumn;
    const rank = new Map(order.map((heroId, index) => [heroId, index]));
    const optimize = [...byColumn.optimize].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    return { ...byColumn, optimize };
  }, [byColumn, order, priorityMode]);
  const priorityById = useMemo(
    () =>
      priorityMode
        ? new Map(order.map((heroId, index) => [heroId, { rank: index + 1, count: order.length }]))
        : undefined,
    [order, priorityMode],
  );
  const onShiftPriority = useCallback(
    (heroId: string, delta: number) => onPriorityOrder(shiftPriority(order, heroId, delta)),
    [order, onPriorityOrder],
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
    const from = resolvedScope[heroId] ?? 'optimize';
    if (priorityMode && target === 'optimize') {
      // Dropped on an Optimize card: take its place. Dropped on the column itself: go last.
      const overHeroId = optimizeCardId(over.data.current);
      if (overHeroId === heroId) return;
      if (from !== target) onScope(heroId, target);
      if (from !== target || overHeroId !== null || order.at(-1) !== heroId) {
        onPriorityOrder(movePriorityBefore(order, heroId, overHeroId));
      }
      return;
    }
    if (from === target) return;
    onScope(heroId, target);
  };

  return (
    <Panel>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <div className={panelHClass}>
          <div className="flex items-center gap-1.5">
            <h2 className={panelTitleClass}>{t.teamPlanScopeSectionTitle}</h2>
            <InfoTip label={t.teamPlanScopeSectionTitle} tip={t.teamPlanScopeBoardTip} />
          </div>
          {headerAction}
        </div>
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
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {SCOPE_COLUMNS.map((scope) => (
              <ScopeColumn
                key={scope}
                scope={scope}
                heroes={columns[scope]}
                scopeByHeroId={resolvedScope}
                t={t}
                lang={lang}
                onScope={onScope}
                {...(scope === 'optimize' && priorityById ? { priorityById, onShiftPriority } : {})}
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
        </DndContext>
      </Tooltip.Provider>
    </Panel>
  );
}
