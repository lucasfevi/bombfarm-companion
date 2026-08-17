import type { HeroRecord } from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores/planner-store';

/**
 * Apply a roster hero as the active draft with persist lock semantics
 * (begin → set id → draft fields → unlock). Used by shell import + phases picker.
 */
export function commitActiveHero(hero: HeroRecord): void {
  const state = usePlannerStore.getState();
  state.beginHeroMutation();
  state.setSkipPhaseMitigationSync(true);
  state.setActiveHeroId(hero.id);
  state.applyHero(hero);
  queueMicrotask(() => {
    const next = usePlannerStore.getState();
    next.setSkipPhaseMitigationSync(false);
    next.unlockPersist();
  });
}
