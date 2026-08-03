import type { StateCreator } from 'zustand';
import { patchHeroInList, type HeroRecord } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import {
  writeActiveHeroId,
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

  importHeroRecords: (records) => {
    const result = writeImportedRoster(get().heroes, records);
    set({ heroes: result.heroes });
    return result;
  },
});
