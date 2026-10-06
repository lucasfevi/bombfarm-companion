/**
 * A hero record makes a round trip on every autosave: storage normalizes it, the draft store
 * spreads it across ~20 flat fields, and `buildHeroRecord` reassembles it. Every hop is a
 * hand-maintained field list, so a field added to one hop and forgotten on the next compiles,
 * type-checks, and silently drops that field off the active hero 700ms later.
 *
 * These guards compare VALUES, strictly, for every field the stored record carries — not field
 * names, because the rebuild always emits every key and a lost value keeps its key. The fixture is
 * held to the same standard: a field that holds nothing, or holds what a default would hold, proves
 * nothing about the hop that was meant to carry it, so the fixture is checked field by field and the
 * guards name what is missing instead of reporting that a count is wrong.
 */
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { normalizeHero, type HeroRecord } from '@/shared/lib/storage';
import { selectHeroDraftTuple } from '@/shared/stores/persistence/persist-hero-draft';
import { defaultHeroDraftFields } from '@/shared/stores/slices/hero-draft-slice';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { populatedHeroRecord } from './helpers/populated-hero-record';

/**
 * Field names a normalized record carries that the rebuilt record is EXPECTED to lack, each with
 * the reason it is legitimately absent. This is the only sanctioned way for the two to differ —
 * a future field is not on this list and therefore cannot slip through it. "the allowance has not
 * rotted" below re-proves each entry, so an allowance that stops being true fails instead of
 * quietly widening the guard.
 */
const REBUILT_RECORD_OMISSIONS: Record<string, string> = {
  updatedAt: 'the save time is stamped by the writer at write time; the draft never holds it',
};

const DRAFT_FIELD_OF_STORED_KEY: Record<string, string> = {
  name: 'heroName',
  sourceId: 'heroSourceId',
  rank: 'heroRank',
  power: 'heroPower',
  deployed: 'heroDeployed',
  battleAllowed: 'heroBattleAllowed',
  marketable: 'heroMarketable',
  skin: 'heroSkin',
};
const STORED_KEYS_WITHOUT_DRAFT_FIELD = ['id', 'updatedAt'];
const DRAFT_FIELDS_WITHOUT_STORED_KEY = ['skipPhaseMitigationSync'];

const draftFieldOf = (storedKey: string) => DRAFT_FIELD_OF_STORED_KEY[storedKey] ?? storedKey;

const asFields = (record: object) => record as Record<string, unknown>;

const bareRecord = () => normalizeHero({ id: 'bare', name: 'Bare' });

const storedKeys = () => Object.keys(bareRecord());

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

function loadIntoDraft(record: HeroRecord) {
  const store = usePlannerStore.getState();
  store.setActiveHeroId(record.id);
  store.applyHero(record);
}

function rebuildFromDraft() {
  return usePlannerStore.getState().buildHeroRecord(usePlannerStore.getState().activeHeroId);
}

/**
 * The record is compared against a deep copy taken BEFORE it enters the draft, so a hop that
 * mutates the object it was handed cannot hide behind sharing a reference with the baseline.
 */
function roundTrip(record: HeroRecord) {
  const expected = structuredClone(record);
  loadIntoDraft(record);
  return { expected, rebuilt: rebuildFromDraft() };
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

  it('every field a normalized record carries comes back from the draft store with the same value', () => {
    const { expected, rebuilt } = roundTrip(populatedHeroRecord());
    const expectedFields = asFields(expected);
    const rebuiltFields = asFields(rebuilt);

    const altered = Object.keys(expectedFields).filter(
      (key) =>
        !(key in REBUILT_RECORD_OMISSIONS) &&
        (!(key in rebuiltFields) || !isDeepStrictEqual(rebuiltFields[key], expectedFields[key])),
    );

    expect(
      altered,
      `the draft store rebuilds a hero record that loses or alters these stored field(s): ${altered.join(', ')} — ` +
        'carry each one through applyHero, the draft slice and buildHeroRecord (and add it to the autosave ' +
        'watch list), or give it a named entry in REBUILT_RECORD_OMISSIONS with the reason it cannot survive',
    ).toEqual([]);
  });

  it('the draft store rebuilds no field the stored record does not carry', () => {
    const { expected, rebuilt } = roundTrip(populatedHeroRecord());

    const invented = Object.keys(rebuilt).filter((key) => !(key in expected));

    expect(
      invented,
      `buildHeroRecord emits field(s) that HeroRecord and normalizeHero do not carry: ${invented.join(', ')} — ` +
        'a field only the draft rebuilds is dropped by the very next normalize',
    ).toEqual([]);
  });

  it('a bare record comes back bare — absent optional fields are not invented by the draft', () => {
    const { expected, rebuilt } = roundTrip(bareRecord());
    const { updatedAt: _stamp, ...expectedWithoutStamp } = expected;

    expect(rebuilt).toStrictEqual(expectedWithoutStamp);
  });

  it('the rebuilt name is trimmed, and a blank name falls back to the default name', () => {
    const record = populatedHeroRecord();

    loadIntoDraft({ ...record, name: '  Round Trip  ' });
    expect(rebuildFromDraft().name).toBe('Round Trip');

    loadIntoDraft({ ...record, name: '   ' });
    expect(rebuildFromDraft().name).toBe(defaultHeroDraftFields().heroName);
  });

  it('the allowance has not rotted — each omission is still a stored field and still absent', () => {
    const { expected, rebuilt } = roundTrip(populatedHeroRecord());
    const expectedFields = asFields(expected);
    const rebuiltFields = asFields(rebuilt);

    const stale = Object.keys(REBUILT_RECORD_OMISSIONS).filter(
      (key) =>
        !(key in expectedFields) ||
        (key in rebuiltFields && isDeepStrictEqual(rebuiltFields[key], expectedFields[key])),
    );

    expect(
      stale,
      `these allowances no longer describe reality and must be removed: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  it('every stored field has a draft field, and every draft field but the draft-only ones backs a stored field', () => {
    const draftFields = Object.keys(defaultHeroDraftFields());

    const storedWithoutDraft = storedKeys().filter(
      (key) => !STORED_KEYS_WITHOUT_DRAFT_FIELD.includes(key) && !draftFields.includes(draftFieldOf(key)),
    );
    const backedDraftFields = storedKeys().map(draftFieldOf);
    const draftWithoutStored = draftFields.filter(
      (field) => !DRAFT_FIELDS_WITHOUT_STORED_KEY.includes(field) && !backedDraftFields.includes(field),
    );

    expect(
      storedWithoutDraft,
      `no draft field backs these stored field(s): ${storedWithoutDraft.join(', ')} — add the field to ` +
        'defaultHeroDraftFields, or name its draft counterpart in DRAFT_FIELD_OF_STORED_KEY',
    ).toEqual([]);
    expect(
      draftWithoutStored,
      `no stored field backs these draft field(s): ${draftWithoutStored.join(', ')} — name the stored ` +
        'counterpart in DRAFT_FIELD_OF_STORED_KEY, or list it as draft-only',
    ).toEqual([]);
  });

  it('the autosave watch list has one member per rebuilt field', () => {
    const { rebuilt } = roundTrip(populatedHeroRecord());
    const tuple = selectHeroDraftTuple(usePlannerStore.getState());

    expect(
      tuple.length,
      `the autosave watches ${tuple.length} draft values but buildHeroRecord assembles ` +
        `${Object.keys(rebuilt).length} fields`,
    ).toBe(Object.keys(rebuilt).length);
  });

  it('every draft field that changes the rebuilt record also changes the watch list', () => {
    const record = populatedHeroRecord();

    const draftFieldNames = [...Object.keys(defaultHeroDraftFields()), 'activeHeroId'];
    const unwatched: string[] = [];

    for (const fieldName of draftFieldNames) {
      resetPlannerStoreForTests();
      loadIntoDraft(record);
      const before = rebuildFromDraft();
      const tupleBefore = selectHeroDraftTuple(usePlannerStore.getState());

      const state = usePlannerStore.getState() as unknown as Record<string, unknown>;
      usePlannerStore.setState({
        [fieldName]: probeValue(state[fieldName], fieldName),
      } as never);

      const after = rebuildFromDraft();
      const tupleAfter = selectHeroDraftTuple(usePlannerStore.getState());

      const recordChanged = !isDeepStrictEqual(after, before);
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

describe('the fixture the round trip is proven with holds a distinguishable value in every field', () => {
  const fixtureFields = () => asFields(populatedHeroRecord());

  it('populates every field normalizeHero emits', () => {
    const fields = fixtureFields();

    const unpopulated = storedKeys().filter((key) => !(key in fields) || isBlank(fields[key]));

    expect(
      unpopulated,
      `fixture does not populate: ${unpopulated.join(', ')} — give each a real value in ` +
        'populatedHeroRecord, or the round trip cannot see it being lost',
    ).toEqual([]);
  });

  it('holds no value a default or fallback would also produce', () => {
    const fields = fixtureFields();
    const bareFields = asFields(bareRecord());
    const draftDefaults = asFields(defaultHeroDraftFields());

    const repeatingADefault = storedKeys().flatMap((key) => {
      const reasons: string[] = [];
      if (isDeepStrictEqual(fields[key], bareFields[key])) reasons.push('the value normalizeHero fills in');
      const draftField = draftFieldOf(key);
      if (draftField in draftDefaults && isDeepStrictEqual(fields[key], draftDefaults[draftField])) {
        reasons.push('the draft default');
      }
      return reasons.map((reason) => `${key} (${reason})`);
    });

    expect(
      repeatingADefault,
      `the fixture field(s) equal what a default would supply, so a hop that drops the value and ` +
        `falls back to the default goes unseen: ${repeatingADefault.join(', ')}`,
    ).toEqual([]);
  });

  it('has at least as many populated fields as the draft has fields to carry', () => {
    const fields = fixtureFields();
    const populated = Object.keys(fields).filter((key) => !isBlank(fields[key]));
    const floor =
      Object.keys(defaultHeroDraftFields()).filter((field) => !DRAFT_FIELDS_WITHOUT_STORED_KEY.includes(field))
        .length + STORED_KEYS_WITHOUT_DRAFT_FIELD.length;

    expect(
      populated.length,
      `the fixture populates ${populated.length} field(s) but the draft mirrors ${floor - STORED_KEYS_WITHOUT_DRAFT_FIELD.length} ` +
        `and the record adds ${STORED_KEYS_WITHOUT_DRAFT_FIELD.join(' and ')}`,
    ).toBeGreaterThanOrEqual(floor);
  });

  it('keeps the sheets complete, non-zero and different from one another', () => {
    const { naked, birth, gearedOverride, pts } = populatedHeroRecord();
    const sheets = { naked, birth, gearedOverride, pts };

    const incomplete = Object.entries(sheets).flatMap(([name, sheet]) => {
      const values = SHEET_KEYS.map((key) => sheet?.[key]);
      const complete =
        Object.keys(sheet ?? {}).length === SHEET_KEYS.length &&
        values.every((value) => typeof value === 'number' && Number.isFinite(value) && value !== 0) &&
        new Set(values).size === values.length;
      return complete ? [] : [name];
    });
    const names = Object.keys(sheets);
    const identicalPairs = names.flatMap((first, index) =>
      names
        .slice(index + 1)
        .filter((second) => isDeepStrictEqual(sheets[first as keyof typeof sheets], sheets[second as keyof typeof sheets]))
        .map((second) => `${first} = ${second}`),
    );

    expect(
      incomplete,
      `these sheets must carry all ${SHEET_KEYS.length} axes, each non-zero and different from the others: ${incomplete.join(', ')}`,
    ).toEqual([]);
    expect(
      identicalPairs,
      `these sheets hold identical values, so swapping them would go unseen: ${identicalPairs.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps both loadouts filled with different items, so swapping them is visible', () => {
    const { loadout, altLoadout } = populatedHeroRecord();
    const filled = (value: typeof loadout | null) =>
      Object.values(value ?? {}).filter((slot) => slot !== null && slot !== undefined);
    const allItems = [...filled(loadout), ...filled(altLoadout)].map((equipped) => JSON.stringify(equipped));

    expect(filled(loadout).length, 'loadout fills fewer than 2 slots').toBeGreaterThanOrEqual(2);
    expect(filled(altLoadout).length, 'altLoadout fills fewer than 2 slots').toBeGreaterThanOrEqual(2);
    expect(isDeepStrictEqual(loadout, altLoadout), 'loadout and altLoadout are identical').toBe(false);
    expect(new Set(allItems).size, 'two equipped items are identical').toBe(allItems.length);
  });

  it('keeps runes on several axes including crit damage, with a non-default rarity and distinct values', () => {
    const runes = populatedHeroRecord().runes ?? [];
    const axes = new Set(runes.map((rune) => rune.axis));

    expect(axes.size, 'runes cover fewer than 3 axes').toBeGreaterThanOrEqual(3);
    expect(axes.has('critdmg'), 'runes do not include critdmg').toBe(true);
    expect(
      runes.some((rune) => rune.rarity !== 0),
      'every rune has rarity 0, which is also what normalization fills in',
    ).toBe(true);
    expect(new Set(runes.map((rune) => rune.strengthPct)).size, 'two runes share a strengthPct').toBe(runes.length);
    expect(new Set(runes.map((rune) => rune.playSecondsLeft)).size, 'two runes share a playSecondsLeft').toBe(
      runes.length,
    );
  });

  it('keeps a roll window on every axis, each different from the others', () => {
    const ranges = asFields(populatedHeroRecord().statRanges ?? {}) as Record<string, { min: number; max: number }>;
    const windows = Object.values(ranges);

    expect([...Object.keys(ranges)].sort(), 'statRanges does not cover every sheet axis').toEqual(
      [...SHEET_KEYS].sort(),
    );
    expect(
      windows.every((window) => window.min < window.max),
      'a statRanges window is empty or inverted',
    ).toBe(true);
    expect(new Set(windows.map((window) => window.min)).size, 'two axes share a min').toBe(windows.length);
    expect(new Set(windows.map((window) => window.max)).size, 'two axes share a max').toBe(windows.length);
  });
});
