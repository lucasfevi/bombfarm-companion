import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FARM_VIEW, loadFarmView, saveFarmView } from './farm-view-storage';

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
    const view = { farmPoolOverrides: { h1: false }, farmReturnBonus: 'vip' as const, selectedPhase: 7 };
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

  it('drops a return-bonus mode that is not one of the three', () => {
    entries.set(KEY, JSON.stringify({ farmReturnBonus: 'quadruple' }));
    expect(loadFarmView().farmReturnBonus).toBe(DEFAULT_FARM_VIEW.farmReturnBonus);
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
});
