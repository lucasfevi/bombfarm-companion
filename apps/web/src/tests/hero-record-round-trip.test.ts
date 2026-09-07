/**
 * A hero record makes a round trip on every autosave: storage normalizes it, the draft store
 * spreads it across ~20 flat fields, and `buildHeroRecord` reassembles it. Every hop is a
 * hand-maintained field list, so a field added to one hop and forgotten on the next compiles,
 * type-checks, and silently drops that field off the active hero 700ms later.
 *
 * These guards compare field-name SETS rather than spot-checking a field, so they catch the
 * NEXT field as well as the last one, and they name what went missing instead of reporting that
 * a count is wrong.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { SheetStats } from '@bombfarm/domain/gear';
import { normalizeHero, type HeroRecord } from '@/shared/lib/storage';
import { selectHeroDraftTuple } from '@/shared/stores/persistence/persist-hero-draft';
import { defaultHeroDraftFields } from '@/shared/stores/slices/hero-draft-slice';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

/**
 * Field names a normalized record carries that the rebuilt record is EXPECTED to lack, each with
 * the reason it is legitimately absent. This is the only sanctioned way for the sets to differ —
 * a future field is not on this list and therefore cannot slip through it. "the allowance has not
 * rotted" below re-proves each entry, so an allowance that stops being true fails instead of
 * quietly widening the guard.
 */
const REBUILT_RECORD_OMISSIONS: Record<string, string> = {
  updatedAt: 'the save time is stamped by the writer at write time; the draft never holds it',
};

function fullSheet(seed: number): SheetStats {
  return {
    attack: seed + 1,
    energy: seed + 2,
    speed: seed + 3,
    critChance: seed + 4,
    critDmg: seed + 5,
    penetration: seed + 6,
    cdr: seed + 7,
    luck: seed + 8,
  };
}

/** A record with every optional field populated — an absent field would hide a missing hop. */
function fullyPopulatedRecord(): HeroRecord {
  return normalizeHero({
    id: 'hero-round-trip',
    name: 'Round Trip',
    updatedAt: 1_700_000_000_000,
    rarity: 'Épico',
    level: 42,
    stars: 3,
    naked: fullSheet(100),
    loadout: {},
    altLoadout: {},
    gearedOverride: fullSheet(200),
    abilities: { alguma: 4 },
    pts: {
      attack: 1,
      energy: 2,
      speed: 3,
      critChance: 4,
      critDmg: 5,
      penetration: 6,
      cdr: 7,
      luck: 8,
    },
    statPointsAvailable: 9,
    sourceId: 'save-hero-7',
    rank: 'S',
    power: 123_456,
    deployed: true,
    battleAllowed: false,
    marketable: true,
    skin: 5,
    birth: fullSheet(300),
    statRanges: {
      attack: { min: 120, max: 190 },
      energy: { min: 140, max: 220 },
    },
  });
}

function loadIntoDraftAndRebuild(record: HeroRecord) {
  const store = usePlannerStore.getState();
  store.setActiveHeroId(record.id);
  store.applyHero(record);
  return usePlannerStore.getState().buildHeroRecord(usePlannerStore.getState().activeHeroId);
}

/**
 * Probe a single store field: write a value that differs from the one it holds, without needing
 * to know what the field means. Objects and `undefined` take a fresh marker; primitives take a
 * neighbouring value of their own type, because `buildHeroRecord` calls string and number methods
 * on some of them.
 */
function probeValue(current: unknown, fieldName: string): unknown {
  if (typeof current === 'string') return `${current}-probe`;
  if (typeof current === 'number') return current + 1;
  if (typeof current === 'boolean') return !current;
  return { roundTripProbe: fieldName };
}

describe('a hero record survives the storage → draft → storage round trip whole', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('every field a normalized record carries is rebuilt by the draft store', () => {
    const normalized = fullyPopulatedRecord();
    const rebuilt = loadIntoDraftAndRebuild(normalized);

    const rebuiltKeys = new Set(Object.keys(rebuilt));
    const dropped = Object.keys(normalized).filter(
      (key) => !rebuiltKeys.has(key) && !(key in REBUILT_RECORD_OMISSIONS),
    );

    expect(
      dropped,
      `the draft store rebuilds a hero record without these stored field(s): ${dropped.join(', ')} — ` +
        'add each one to buildHeroRecord (and to applyHero, the draft slice and the autosave watch ' +
        'list), or give it a named entry in REBUILT_RECORD_OMISSIONS with the reason it cannot survive',
    ).toEqual([]);
  });

  it('the sets are compared over a non-trivial number of fields (otherwise this proves nothing)', () => {
    const normalized = fullyPopulatedRecord();
    expect(Object.keys(normalized).length).toBeGreaterThan(15);
  });

  it('the allowance has not rotted — each omission is still a stored field and still absent', () => {
    const normalized = fullyPopulatedRecord();
    const rebuilt = loadIntoDraftAndRebuild(normalized);
    const rebuiltKeys = new Set(Object.keys(rebuilt));

    const stale = Object.keys(REBUILT_RECORD_OMISSIONS).filter(
      (key) => !(key in normalized) || rebuiltKeys.has(key),
    );

    expect(
      stale,
      `these allowances no longer describe reality and must be removed: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  it('the autosave watch list has one member per rebuilt field', () => {
    const normalized = fullyPopulatedRecord();
    const rebuilt = loadIntoDraftAndRebuild(normalized);
    const tuple = selectHeroDraftTuple(usePlannerStore.getState());

    expect(
      tuple.length,
      `the autosave watches ${tuple.length} draft values but buildHeroRecord assembles ` +
        `${Object.keys(rebuilt).length} fields`,
    ).toBe(Object.keys(rebuilt).length);
  });

  it('every draft field that changes the rebuilt record also changes the watch list', () => {
    const normalized = fullyPopulatedRecord();
    loadIntoDraftAndRebuild(normalized);

    const draftFieldNames = [...Object.keys(defaultHeroDraftFields()), 'activeHeroId'];
    const unwatched: string[] = [];

    for (const fieldName of draftFieldNames) {
      resetPlannerStoreForTests();
      const before = loadIntoDraftAndRebuild(normalized);
      const tupleBefore = selectHeroDraftTuple(usePlannerStore.getState());

      const state = usePlannerStore.getState() as unknown as Record<string, unknown>;
      usePlannerStore.setState({
        [fieldName]: probeValue(state[fieldName], fieldName),
      } as never);

      const after = usePlannerStore.getState().buildHeroRecord(usePlannerStore.getState().activeHeroId);
      const tupleAfter = selectHeroDraftTuple(usePlannerStore.getState());

      const recordChanged = JSON.stringify(after) !== JSON.stringify(before);
      const watchListChanged = tupleAfter.some((value, index) => !Object.is(value, tupleBefore[index]));

      if (recordChanged && !watchListChanged) unwatched.push(fieldName);
    }

    expect(
      unwatched,
      `these draft field(s) reach the persisted hero record but the autosave never sees them ` +
        `change, so an edit to one is silently discarded: ${unwatched.join(', ')} — add each to ` +
        'selectHeroDraftTuple',
    ).toEqual([]);
  });
});
