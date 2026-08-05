import type { StateCreator } from 'zustand';
import { patchHeroInList, type HeroRecord } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import {
  writeActiveHeroId,
  writeHeroBattleAllowed,
  writeImportedRoster,
  writeRosterAfterDelete,
} from '@/shared/stores/persistence/persist-roster';

export type RosterSlice = {
  heroes: HeroRecord[];
  activeHeroId: string | null;

  hydrateRoster: (heroes: HeroRecord[], activeHeroId: string | null) => void;
  setHeroes: (heroes: HeroRecord[]) => void;
  patchHero: (saved: HeroRecord) => void;
  removeHero: (id: string) => void;
  setActiveHeroId: (id: string | null) => void;
  /** Persist enable/disable immediately; syncs the open draft when `heroId` is active. */
  setHeroBattleAllowedOnHero: (heroId: string, battleAllowed: boolean) => void;
  importHeroRecords: (
    records: (Omit<HeroRecord, 'id' | 'updatedAt'> & { sourceId: string })[],
  ) => { heroes: HeroRecord[]; created: number; updated: number };
};

export const createRosterSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  RosterSlice
> = (set, get) => ({
  heroes: [],
  activeHeroId: null,

  hydrateRoster: (heroes, activeHeroId) => {
    set({ heroes, activeHeroId });
  },

  setHeroes: (heroes) => {
    set({ heroes });
  },

  patchHero: (saved) => {
    set((state) => ({ heroes: patchHeroInList(state.heroes, saved) }));
  },

  removeHero: (heroId) => {
    const wasActive = get().activeHeroId === heroId;
    const next = writeRosterAfterDelete(get().heroes, heroId);
    set({
      heroes: next,
      activeHeroId: wasActive ? null : get().activeHeroId,
    });
  },

  setActiveHeroId: (heroId) => {
    if (get().activeHeroId === heroId) return;
    writeActiveHeroId(heroId);
    set({ activeHeroId: heroId });
  },

  setHeroBattleAllowedOnHero: (heroId, battleAllowed) => {
    const state = get();
    const next = writeHeroBattleAllowed(state.heroes, heroId, battleAllowed);
    if (next === state.heroes) return;
    if (state.activeHeroId === heroId) {
      state.skipNextHeroToast();
      set({ heroes: next, heroBattleAllowed: battleAllowed });
      return;
    }
    set({ heroes: next });
  },

  importHeroRecords: (records) => {
    const result = writeImportedRoster(get().heroes, records);
    const activeId = get().activeHeroId;
    const active = activeId
      ? result.heroes.find((hero) => hero.id === activeId)
      : undefined;
    if (!active) {
      set({ heroes: result.heroes });
      return result;
    }
    set({
      heroes: result.heroes,
      heroBattleAllowed: active.battleAllowed ?? true,
    });
    return result;
  },
});
