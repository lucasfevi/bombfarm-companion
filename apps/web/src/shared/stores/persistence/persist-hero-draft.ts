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
    state.statRanges,
    state.heroSourceId,
    state.heroRank,
    state.heroPower,
    state.heroDeployed,
    state.heroBattleAllowed,
    state.heroMarketable,
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
    // A draft autosave may only UPDATE a hero the roster still holds — it must never create one.
    // The write is debounced by 700ms, and an import inside that window replaces the roster
    // wholesale while a write staged against the OLD one is still pending. `upsertHero` appends
    // an id it cannot find, so that late write resurrected a hero from the previous account into
    // the newly imported roster: a 4-hero save became 5 heroes, the extra one belonging to an
    // account the player had just replaced. Creating roster entries is `importHeroes`' job, which
    // is what `upsertHero`'s own sourceId error says.
    if (!state.heroes.some((hero) => hero.id === staged.id)) return;
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
