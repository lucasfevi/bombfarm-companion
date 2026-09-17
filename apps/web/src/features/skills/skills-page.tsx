'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SkillTreeScreen } from '@bombfarm/account/skill-tree';
import {
  parseSkillTreeState,
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
import { priceSkillsView, skillsPricingKey, skillsTotalsOf } from './skills-pricing';
import { loadSkillsView, saveSkillsView } from './skills-view-storage';

function useKeyedMemo<T>(key: string | null, compute: () => T): T {
  const cache = useRef<{ key: string | null; value: T } | null>(null);
  if (cache.current === null || cache.current.key !== key) {
    cache.current = { key, value: compute() };
  }
  return cache.current.value;
}

function useStoredObjective(): [SkillPricingObjective, (next: SkillPricingObjective) => void] {
  const [objective, setObjective] = useState<SkillPricingObjective>('goldPerHour');
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setObjective(loadSkillsView().objective);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveSkillsView({ objective });
  }, [storageReady, objective]);

  return [objective, setObjective];
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

const pageShellClass = cn('absolute', 'inset-0', 'flex', 'min-h-0', 'flex-1', 'flex-col');

export function SkillsPage() {
  const { t, lang } = useAppLang();
  const skillTree = usePlannerStore((state) => state.skillTree ?? null);
  const maxPhase = usePlannerStore((state) => state.maxPhase);
  const fieldSlots = usePlannerStore((state) => state.fieldSlots);
  const [objective, setObjective] = useStoredObjective();

  const state = useMemo(
    () => (skillTree === null ? null : treeStateFromStore(skillTree, maxPhase, fieldSlots)),
    [skillTree, maxPhase, fieldSlots],
  );
  const totals = useMemo(() => (state === null ? null : skillsTotalsOf(state)), [state]);
  const labels = useMemo(() => skillTreeLabels(t, lang, 'farm'), [t, lang]);
  const pricingKey = usePlannerStore(skillsPricingKey);
  const pricing = useKeyedMemo<SkillTreePricing | null>(pricingKey, () => {
    const store = usePlannerStore.getState();
    if (state === null || totals === null || store.phase === null) return null;
    return priceSkillsView(store, state, totals, store.phase);
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
        nodeArtSrc={skillNodeArtSrc}
        labels={labels}
      />
    </div>
  );
}
