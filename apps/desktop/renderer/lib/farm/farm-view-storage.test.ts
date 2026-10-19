import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FARM_VIEW,
  effectiveMapSize,
  isMapSizeDetected,
  loadFarmView,
  mapSizeOverrideFor,
  saveFarmMapSizeOverride,
  saveFarmView,
} from './farm-view-storage';

const KEY = 'bfc-farm-view';

type FakeWindow = { localStorage: Storage };

function installStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as Storage;
  (globalThis as unknown as { window?: FakeWindow }).window = { localStorage: storage };
  return entries;
}

describe('farm view preferences', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = installStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });

  it('is stored under its own key, never the web planner key', () => {
    saveFarmView({ ...DEFAULT_FARM_VIEW, selectedPhase: 42 });
    expect([...entries.keys()]).toEqual([KEY]);
  });

  it('round-trips what was written', () => {
    const view = {
      farmPoolOverrides: { h1: false },
      farmReturnBonus: 'on' as const,
      aurasAtCap: ['grito_guerra', 'passagem_bastao'] as const,
      selectedPhase: 7,
      farmMapSizeOverride: 'compact' as const,
    };
    saveFarmView(view);
    expect(loadFarmView()).toEqual(view);
  });

  it('reads the defaults when nothing was ever stored', () => {
    expect(loadFarmView()).toEqual(DEFAULT_FARM_VIEW);
  });

  it('reads the defaults from a corrupt value rather than throwing', () => {
    entries.set(KEY, '{not json');
    expect(loadFarmView()).toEqual(DEFAULT_FARM_VIEW);
  });

  it('reads the defaults when localStorage is not reachable at all', () => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
    expect(loadFarmView()).toEqual(DEFAULT_FARM_VIEW);
  });

  it('reads a return bonus stored as the old VIP mode as on', () => {
    entries.set(KEY, JSON.stringify({ farmReturnBonus: 'vip' }));
    expect(loadFarmView().farmReturnBonus).toBe('on');
  });

  it('drops a return-bonus mode that is not one of the known ones', () => {
    entries.set(KEY, JSON.stringify({ farmReturnBonus: 'quadruple' }));
    expect(loadFarmView().farmReturnBonus).toBe(DEFAULT_FARM_VIEW.farmReturnBonus);
  });

  it('keeps only real aura ids out of the stored list, in the domain’s order, and the frozen empty list otherwise', () => {
    entries.set(KEY, JSON.stringify({ aurasAtCap: ['passagem_bastao', 'nope', 7, 'grito_guerra'] }));
    expect(loadFarmView().aurasAtCap).toEqual(['grito_guerra', 'passagem_bastao']);
    entries.set(KEY, JSON.stringify({ aurasAtCap: 'grito_guerra' }));
    expect(loadFarmView().aurasAtCap).toBe(DEFAULT_FARM_VIEW.aurasAtCap);
    entries.set(KEY, JSON.stringify({}));
    expect(loadFarmView().aurasAtCap).toBe(DEFAULT_FARM_VIEW.aurasAtCap);
  });

  it('keeps only the boolean pool overrides out of a half-written record', () => {
    entries.set(KEY, JSON.stringify({ farmPoolOverrides: { h1: true, h2: 'yes', h3: null, h4: false } }));
    expect(loadFarmView().farmPoolOverrides).toEqual({ h1: true, h4: false });
  });

  it('drops a pool override block that is not a record', () => {
    entries.set(KEY, JSON.stringify({ farmPoolOverrides: ['h1'] }));
    expect(loadFarmView().farmPoolOverrides).toEqual({});
  });

  it.each([0, -3, 12.5, '30', null])('drops a selected phase of %s', (value) => {
    entries.set(KEY, JSON.stringify({ selectedPhase: value }));
    expect(loadFarmView().selectedPhase).toBeNull();
  });

  it('normalises a partial record into a whole one', () => {
    entries.set(KEY, JSON.stringify({ selectedPhase: 12 }));
    expect(loadFarmView()).toEqual({ ...DEFAULT_FARM_VIEW, selectedPhase: 12 });
  });

  it('reads an older stored view without a map size as following the game', () => {
    entries.set(KEY, JSON.stringify({ farmReturnBonus: 'on', selectedPhase: 12 }));
    expect(loadFarmView().farmMapSizeOverride).toBeNull();
  });

  it.each(['huge', 209, true])('drops a stored map size of %s', (value) => {
    entries.set(KEY, JSON.stringify({ farmMapSizeOverride: value }));
    expect(loadFarmView().farmMapSizeOverride).toBeNull();
  });

  it('writes the map size alone and leaves the rest of the view as it was', () => {
    const view = { ...DEFAULT_FARM_VIEW, farmReturnBonus: 'on' as const, selectedPhase: 30 };
    saveFarmView(view);
    saveFarmMapSizeOverride('compact');
    expect(loadFarmView()).toEqual({ ...view, farmMapSizeOverride: 'compact' });
  });
});

describe('the map size the Farm board and the Optimizer price on', () => {
  it('is the player’s pick over the game’s, the game’s with no pick, and the classic field with neither', () => {
    expect(effectiveMapSize('classic', 'compact')).toBe('classic');
    expect(effectiveMapSize(null, 'compact')).toBe('compact');
    expect(effectiveMapSize(null, null)).toBe('classic');
  });

  it('reads as detected only while it follows a game that is showing a map', () => {
    expect(isMapSizeDetected(null, 'compact')).toBe(true);
    expect(isMapSizeDetected('compact', 'compact')).toBe(false);
    expect(isMapSizeDetected(null, null)).toBe(false);
  });

  it('picking the size the game is drawing clears the pick, so a later switch in the game is followed', () => {
    expect(mapSizeOverrideFor('compact', 'compact')).toBeNull();
    expect(mapSizeOverrideFor('classic', 'compact')).toBe('classic');
  });

  it('keeps the pick when no game is showing a map', () => {
    expect(mapSizeOverrideFor('compact', null)).toBe('compact');
    expect(mapSizeOverrideFor('classic', null)).toBe('classic');
  });
});
