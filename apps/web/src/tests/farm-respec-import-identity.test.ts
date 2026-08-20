/**
 * The user-visible half of the roster-identity invariant, on the IMPORT path: re-importing a save
 * file that changed nothing must not invalidate a live farm-respec proposal.
 *
 * The autosave counterpart lives in `farm-ranking-selectors.test.ts`'s staleness block ("a NO-OP
 * autosave patch does not invalidate the proposal"); this file is separate only because that suite
 * sits at its `max-lines` cap. `storage-import-heroes-identity.test.ts` covers the producer half
 * (`importHeroes`' return reference) on its own.
 *
 * These cases drive the REAL production path: `handleConfirm`
 * (`features/import/hooks/use-import-candidates.ts`) calls `importHeroes`, and the shell's
 * `handleImported` (`app/_shell/app-shell-inner.tsx`) feeds the result to `setHeroes`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { importHeroes, normalizeHero, type HeroRecord } from '@/shared/lib/storage';
import {
  readFarmRespecDepTuple,
  resetFarmRankingCache,
  resetFarmRespecSolveCount,
  runFarmRespecSolve,
  selectFarmRespecIsStale,
  selectFarmRespecStatus,
  selectFarmRespecView,
  selectFarmReRankActive,
} from '@/shared/stores/selectors/farm-ranking-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

function farmHero(id: string): HeroRecord {
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    gearedOverride: {
      attack: 100,
      energy: 100,
      speed: 50,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: true,
  });
}

/** A roster record turned back into the import RECORD shape `importHeroes` consumes — what a
 *  re-import of the same save file hands it. */
function toImportRecord(hero: HeroRecord) {
  const { id, updatedAt: _updatedAt, sourceId, ...rest } = hero;
  return { ...rest, sourceId: sourceId ?? `src-${id}` };
}

/** Solve once and stamp the result as the live proposal — the state the board is in when a user
 *  has asked for a respec and is looking at it. */
function primeFreshProposal(): void {
  const result = runFarmRespecSolve(usePlannerStore.getState());
  usePlannerStore.setState({
    farmRespecProposal: { deps: readFarmRespecDepTuple(usePlannerStore.getState()), result },
    farmRespecStatus: 'done',
  });
}

/** Run the import exactly as `handleConfirm` does, then hand the result to the store. */
function reimport(records: ReturnType<typeof toImportRecord>[]): HeroRecord[] {
  const saveSourceIds = new Set(records.map((entry) => entry.sourceId));
  const result = importHeroes(usePlannerStore.getState().heroes, records, saveSourceIds);
  usePlannerStore.getState().setHeroes(result.heroes);
  return result.heroes;
}

describe('a re-import through the real import path and a live respec proposal', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingCache();
    resetFarmRespecSolveCount();
    usePlannerStore.getState().hydrateRoster([farmHero('a'), farmHero('b')], null);
    primeFreshProposal();
    usePlannerStore.getState().setFarmRespecReRank(true);
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingCache();
    resetFarmRespecSolveCount();
  });

  it('a NO-OP re-import keeps the roster identity and the proposal stays live', () => {
    const before = usePlannerStore.getState().heroes;

    const imported = reimport(before.map(toImportRecord));

    expect(imported).toBe(before);
    const state = usePlannerStore.getState();
    expect(state.heroes).toBe(before);
    expect(selectFarmRespecIsStale(state)).toBe(false);
    expect(selectFarmRespecView(state)).toBe(state.farmRespecProposal);
    expect(selectFarmRespecStatus(state)).toBe('done');
    expect(selectFarmReRankActive(state)).toBe(true);
  });

  it('a re-import that DID change a hero still invalidates the proposal', () => {
    const before = usePlannerStore.getState().heroes;

    const imported = reimport(
      before.map((hero) => toImportRecord({ ...hero, level: hero.level + 1 })),
    );

    expect(imported).not.toBe(before);
    const state = usePlannerStore.getState();
    expect(selectFarmRespecIsStale(state)).toBe(true);
    expect(selectFarmRespecView(state)).toBeNull();
    expect(selectFarmRespecStatus(state)).toBe('idle');
    expect(selectFarmReRankActive(state)).toBe(false);
  });

  it('a re-import that DROPPED a hero still invalidates the proposal', () => {
    const before = usePlannerStore.getState().heroes;

    const imported = reimport([toImportRecord(before[0])]);

    expect(imported).not.toBe(before);
    expect(usePlannerStore.getState().heroes).toHaveLength(1);
    expect(selectFarmRespecIsStale(usePlannerStore.getState())).toBe(true);
  });
});
