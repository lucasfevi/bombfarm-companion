/**
 * The user-visible half of the roster-identity invariant, on the IMPORT path: re-importing a save
 * file that changed nothing must not recompute the 600-row farm board.
 *
 * The autosave counterpart lives in `farm-ranking-selectors.test.ts` ("a NO-OP autosave patch does
 * not recompute the board"); this file is separate only because that suite sits at its
 * `max-lines` cap. `storage-import-heroes-identity.test.ts` covers the producer half
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
  getFarmRankingComputeCount,
  resetFarmRankingComputeCount,
  selectFarmRankingRows,
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

/** Compute the board once — the state the memo is in when a user is looking at the Farm page. */
function primeBoard(): void {
  selectFarmRankingRows(usePlannerStore.getState());
}

/** Run the import exactly as `handleConfirm` does, then hand the result to the store. */
function reimport(records: ReturnType<typeof toImportRecord>[]): HeroRecord[] {
  const saveSourceIds = new Set(records.map((entry) => entry.sourceId));
  const result = importHeroes(usePlannerStore.getState().heroes, records, saveSourceIds);
  usePlannerStore.getState().setHeroes(result.heroes);
  return result.heroes;
}

describe('a re-import through the real import path and the farm board it must not recompute', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
    usePlannerStore.getState().hydrateRoster([farmHero('a'), farmHero('b')], null);
    primeBoard();
    expect(getFarmRankingComputeCount()).toBe(1);
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingComputeCount();
  });

  it('a NO-OP re-import keeps the roster identity and the board answers from its cache', () => {
    const before = usePlannerStore.getState().heroes;
    const rows = selectFarmRankingRows(usePlannerStore.getState());

    const imported = reimport(before.map(toImportRecord));

    expect(imported).toBe(before);
    const state = usePlannerStore.getState();
    expect(state.heroes).toBe(before);
    expect(selectFarmRankingRows(state)).toBe(rows);
    expect(getFarmRankingComputeCount()).toBe(1);
  });

  it('a re-import that DID change a hero still recomputes the board', () => {
    const before = usePlannerStore.getState().heroes;
    const rows = selectFarmRankingRows(usePlannerStore.getState());

    const imported = reimport(
      before.map((hero) => toImportRecord({ ...hero, level: hero.level + 1 })),
    );

    expect(imported).not.toBe(before);
    const state = usePlannerStore.getState();
    expect(selectFarmRankingRows(state)).not.toBe(rows);
    expect(getFarmRankingComputeCount()).toBe(2);
  });

  it('a re-import that DROPPED a hero still recomputes the board', () => {
    const before = usePlannerStore.getState().heroes;

    const imported = reimport([toImportRecord(before[0])]);

    expect(imported).not.toBe(before);
    expect(usePlannerStore.getState().heroes).toHaveLength(1);
    selectFarmRankingRows(usePlannerStore.getState());
    expect(getFarmRankingComputeCount()).toBe(2);
  });
});
