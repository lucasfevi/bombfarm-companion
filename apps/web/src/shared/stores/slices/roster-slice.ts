import type { StateCreator } from 'zustand';
import { patchHeroInList, type HeroRecord } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';
import {
  writeActiveHeroId,
  writeHeroBattleAllowed,
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
};

/** Fields a roster write may carry alongside `heroes` in the same `set`. */
type RosterCompanionFields = Partial<Pick<PlannerStore, 'activeHeroId' | 'heroBattleAllowed'>>;

export const createRosterSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  RosterSlice
> = (set, get) => {
  /**
   * The ONLY place this slice writes `state.heroes`. It enforces the consumer half of a two-part
   * identity invariant:
   *
   * 1. PRODUCER — a roster-producing helper (`patchHeroInList`, `importHeroes`,
   *    `writeHeroBattleAllowed` in `@/shared/lib/storage` and `persistence/persist-roster.ts`)
   *    returns the SAME array when nothing changed, and
   * 2. CONSUMER — this helper declines to `set` when that reference came back unchanged.
   *
   * Why it is load-bearing: `state.heroes` is member 0 of `readFarmDepTuple`
   * (`stores/selectors/farm-ranking-selectors.ts`), whose members are compared with `Object.is`.
   * A fresh-but-equal roster array therefore reads exactly like a real planner edit —
   * `selectFarmRespecView` judges a still-valid farm-respec proposal stale, the board silently
   * falls back to the current build, and `selectFarmRespecStatus` collapses to `'idle'` with no
   * error surfaced. Both halves are needed: a producer that reallocates defeats this check, and a
   * writer that bypasses this helper defeats a well-behaved producer.
   *
   * The check is a REFERENCE compare, never a deep one — value equality is the producer's job,
   * where the shape of a `HeroRecord` is known and the comparison runs once per write.
   *
   * Companion fields still land on an unchanged roster: `hydrateRoster`'s `activeHeroId` is
   * separate state that a boot with an already-identical roster array must still apply, and the
   * guard must not swallow it. Returns whether the roster reference actually moved, so a caller
   * can skip follow-up work it only owes on a real change.
   */
  function commitRoster(next: HeroRecord[], also: RosterCompanionFields = {}): boolean {
    if (next === get().heroes) {
      if (Object.keys(also).length > 0) set(also);
      return false;
    }
    set({ ...also, heroes: next });
    return true;
  }

  return {
    heroes: [],
    activeHeroId: null,

    hydrateRoster: (heroes, activeHeroId) => {
      commitRoster(heroes, { activeHeroId });
    },

    setHeroes: (heroes) => {
      commitRoster(heroes);
      get().syncScopeForRoster();
    },

    patchHero: (saved) => {
      commitRoster(patchHeroInList(get().heroes, saved));
    },

    removeHero: (heroId) => {
      const wasActive = get().activeHeroId === heroId;
      const next = writeRosterAfterDelete(get().heroes, heroId);
      commitRoster(next, { activeHeroId: wasActive ? null : get().activeHeroId });
      get().syncScopeForRoster();
    },

    setActiveHeroId: (heroId) => {
      if (get().activeHeroId === heroId) return;
      writeActiveHeroId(heroId);
      set({ activeHeroId: heroId });
    },

    setHeroBattleAllowedOnHero: (heroId, battleAllowed) => {
      const state = get();
      const next = writeHeroBattleAllowed(state.heroes, heroId, battleAllowed);
      // NOT a redundant duplicate of `commitRoster`'s check — do not delete it as one. That guard
      // answers "may I write `heroes`"; this one gates THIS ACTION's side effects. A toggle that
      // changed nothing must arm no toast suppression, sync no scope, and touch no draft field:
      // `heroBattleAllowed` is member 17 of `selectHeroDraftTuple`
      // (`persistence/persist-hero-draft.ts`), subscribed with `shallow`, so writing it schedules
      // the 700ms writer — which would then reach `consumeSkipHeroToast()` with nothing armed and
      // fire the "hero saved" toast a real toggle deliberately suppresses.
      if (next === state.heroes) return;
      const isActive = state.activeHeroId === heroId;
      if (isActive) state.skipNextHeroToast();
      commitRoster(next, isActive ? { heroBattleAllowed: battleAllowed } : {});
      get().syncScopeForRoster();
    },
  };
};
