'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SkillTreeScreen } from '@bombfarm/account/skill-tree';
import {
  parseSkillTreeState,
  resolveGatePhase,
  SKILL_TREE,
  SKILL_TREE_LAYOUT,
  type SkillPricingObjective,
  type SkillTreePricing,
  type SkillTreeState,
} from '@bombfarm/domain/skill-tree';
import { skillNodeArtSrc } from '@bombfarm/domain/wiki-assets';
import { EmptyState, cn } from '@bombfarm/ui';
import { useAppLang } from '@/shared/context/app-lang';
import type { AccountShared } from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores';
import { skillTreeLabels } from './skill-tree-labels';
import {
  priceSkillsView,
  skillsPricingKey,
  skillsTotalsOf,
} from './skills-pricing';
import { DEFAULT_SKILLS_VIEW, WEB_SKILLS_OBJECTIVES, loadSkillsView, saveSkillsView, type SkillsView } from './skills-view-storage';

function useKeyedMemo<T>(key: string | null, compute: () => T): T {
  const cache = useRef<{ key: string | null; value: T } | null>(null);
  if (cache.current === null || cache.current.key !== key) {
    cache.current = { key, value: compute() };
  }
  return cache.current.value;
}

function useStoredSkillsView(fromPhase: number | null): {
  objective: SkillPricingObjective;
  setObjective: (next: SkillPricingObjective) => void;
  gatePhase: number;
  setGatePhase: (next: number) => void;
} {
  const [view, setView] = useState<SkillsView>(DEFAULT_SKILLS_VIEW);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setView(loadSkillsView());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || view.gatePhase !== null || fromPhase === null) return;
    setView((current) => ({ ...current, gatePhase: resolveGatePhase(null, fromPhase) }));
  }, [storageReady, view.gatePhase, fromPhase]);

  useEffect(() => {
    if (!storageReady) return;
    saveSkillsView(view);
  }, [storageReady, view]);

  const gatePhase = resolveGatePhase(view.gatePhase, fromPhase ?? 1);
  return {
    objective: view.objective,
    setObjective: (objective) => {
      setView((current) => ({ ...current, objective }));
    },
    gatePhase,
    setGatePhase: (next) => {
      setView((current) => ({ ...current, gatePhase: next }));
    },
  };
}

function treeStateFromStore(
  skillTree: NonNullable<AccountShared['skillTree']>,
  maxPhase: number | null,
  fieldSlots: number | null,
): SkillTreeState | null {
  const parsed = parseSkillTreeState(skillTree);
  if (parsed === null) return null;
  return { ...parsed, maxPhase, fieldSlots };
}

const pageShellClass = cn(
  'absolute',
  'inset-0',
  'mx-auto',
  'flex',
  'min-h-0',
  'w-full',
  'max-w-app',
  'flex-1',
  'flex-col',
  'gap-3',
  'px-4',
  'pt-3',
  'pb-3',
);

export function SkillsPage() {
  const { t, lang } = useAppLang();
  const skillTree = usePlannerStore((state) => state.skillTree ?? null);
  const maxPhase = usePlannerStore((state) => state.maxPhase);
  const fieldSlots = usePlannerStore((state) => state.fieldSlots);
  const farmPhase = usePlannerStore((state) => state.phase);
  const { objective, setObjective, gatePhase, setGatePhase } = useStoredSkillsView(farmPhase);

  const state = useMemo(
    () => (skillTree === null ? null : treeStateFromStore(skillTree, maxPhase, fieldSlots)),
    [skillTree, maxPhase, fieldSlots],
  );
  const totals = useMemo(() => (state === null ? null : skillsTotalsOf(state)), [state]);
  const labels = useMemo(() => skillTreeLabels(t, lang, 'farm'), [t, lang]);
  const pricingKey = usePlannerStore((store) => skillsPricingKey(store, objective, gatePhase));
  const pricing = useKeyedMemo<SkillTreePricing | null>(pricingKey, () => {
    const store = usePlannerStore.getState();
    if (state === null || totals === null || store.phase === null) return null;
    return priceSkillsView(store, state, totals, store.phase, gatePhase);
  });

  if (state === null || totals === null) {
    return (
      <div data-testid="skills-page" className={pageShellClass}>
        <EmptyState title={t.skillsUnreadableTitle} description={t.skillsUnreadableDescription} />
      </div>
    );
  }

  return (
    <div
      data-testid="skills-page"
      data-pricing={pricing === null ? 'none' : 'priced'}
      className={pageShellClass}
    >
      <SkillTreeScreen
        catalog={SKILL_TREE}
        layout={SKILL_TREE_LAYOUT}
        state={state}
        totals={totals}
        pricing={pricing}
        objective={objective}
        onObjectiveChange={setObjective}
        objectives={WEB_SKILLS_OBJECTIVES}
        gatePhase={gatePhase}
        onGatePhaseChange={setGatePhase}
        nodeArtSrc={skillNodeArtSrc}
        labels={labels}
      />
    </div>
  );
}
