import { shallow } from 'zustand/shallow';
import { shouldShowEmptyState, upsertHero } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import { usePlannerStore } from '@/shared/stores/planner-store';
import { setHeroSaveRescheduler } from '@/shared/stores/slices/session-slice';
import { selectStrings } from '@/shared/stores/selectors/session-selectors';
import { AUTOSAVE_MS, createDebouncedWriter } from '@/shared/stores/persistence/debounced-writer';

type Store = typeof usePlannerStore;

/** Draft-field tuple for subscribeWithSelector — mirrors buildHeroRecord inputs. */
export function selectHeroDraftTuple(state: PlannerStore) {
  return [
    state.activeHeroId,
    state.heroName,
    state.rarity,
    state.level,
    state.stars,
    state.naked,
    state.loadout,
    state.altLoadout,
    state.gearedOverride,
    state.abilities,
    state.pts,
    state.birth,
    state.heroSourceId,
    state.heroRank,
    state.heroPower,
    state.heroDeployed,
    state.heroBattleAllowed,
    state.heroSkin,
    state.statPointsAvailable,
  ] as const;
}

export function attachHeroDraftPersistence(store: Store): () => void {
  const writer = createDebouncedWriter(AUTOSAVE_MS, () => {
    const state = store.getState();
    if (state.isPersistSuppressed) return;
    if (shouldShowEmptyState(state.heroes.length)) return;

    const staged = state.buildHeroRecord(state.activeHeroId);
    const { saved, wrote } = upsertHero(state.heroes, staged);
    state.patchHero(saved);
    if (saved.id !== state.activeHeroId) state.setActiveHeroId(saved.id);
    if (!wrote) return; // write-error listener already toasted toastSaveFailed
    if (state.consumeSkipHeroToast()) return;
    state.flashToast(selectStrings(state).toastHeroSaved);
  });

  function scheduleIfArmable() {
    const state = store.getState();
    if (!state.booted) return;
    if (shouldShowEmptyState(state.heroes.length)) return;
    writer.schedule();
  }

  setHeroSaveRescheduler(scheduleIfArmable);

  const unsub = store.subscribe(selectHeroDraftTuple, scheduleIfArmable, { equalityFn: shallow });

  return () => {
    unsub();
    writer.cancel();
    setHeroSaveRescheduler(null);
  };
}
