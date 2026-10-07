import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FORGE_QUEUE_SETTINGS,
  editQueueStoneRanges,
  loadForgeQueueSettings,
  normalizeForgeQueueSettings,
  queueStoneRanges,
  queueStones,
  saveForgeQueueSettings,
  type ForgeQueueSettings,
} from './forge-queue-settings';
import { createForgeQueueSettingsStore } from './forge-queue-settings-store';

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('bfc-forge-queue-settings', initial);
  vi.stubGlobal('window', {
    localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) },
  });
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the forge queue settings', () => {
  it('start with no stone, the stop on and the scroll off', () => {
    expect(DEFAULT_FORGE_QUEUE_SETTINGS).toEqual({ ranges: [], stopWhenOutOfStones: true, scroll: false });
    expect(queueStones(DEFAULT_FORGE_QUEUE_SETTINGS)).toBeUndefined();
  });

  it('span +5 to +15, where a stone can be used', () => {
    expect(queueStoneRanges(DEFAULT_FORGE_QUEUE_SETTINGS)).toEqual([{ from: 5, to: 15, rarity: null }]);
  });

  it('give the stone for every target by absolute level, none below the first range', () => {
    const settings: ForgeQueueSettings = {
      ranges: [
        { upTo: 9, rarity: null },
        { upTo: 13, rarity: 0 },
        { upTo: 15, rarity: 2 },
      ],
      stopWhenOutOfStones: true,
      scroll: false,
    };
    expect(queueStones(settings)).toEqual([null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 2, 2]);
  });

  it('are edited with the same range edits the Forge screen uses, against +5 to +15', () => {
    const picked = editQueueStoneRanges(DEFAULT_FORGE_QUEUE_SETTINGS, { kind: 'stoneRarity', index: 0, rarity: 1 });
    expect(queueStoneRanges(picked)).toEqual([{ from: 5, to: 15, rarity: 1 }]);
    const split = editQueueStoneRanges(picked, { kind: 'stoneAdd' });
    expect(queueStoneRanges(split).map((range) => [range.from, range.to])).toEqual([
      [5, 10],
      [11, 15],
    ]);
    const moved = editQueueStoneRanges(split, { kind: 'stoneEnd', index: 0, upTo: 12 });
    expect(queueStoneRanges(moved).map((range) => [range.from, range.to])).toEqual([
      [5, 12],
      [13, 15],
    ]);
    const joined = editQueueStoneRanges(moved, { kind: 'stoneJoin' });
    expect(queueStoneRanges(joined)).toEqual([{ from: 5, to: 15, rarity: 1 }]);
  });
});

describe('normalizeForgeQueueSettings', () => {
  it('keeps well-formed settings', () => {
    const settings: ForgeQueueSettings = {
      ranges: [
        { upTo: 12, rarity: 0 },
        { upTo: 15, rarity: null },
      ],
      stopWhenOutOfStones: false,
      scroll: true,
    };
    expect(normalizeForgeQueueSettings(settings)).toEqual(settings);
  });

  it('falls back to the default for anything that is not settings', () => {
    expect(normalizeForgeQueueSettings(null)).toEqual(DEFAULT_FORGE_QUEUE_SETTINGS);
    expect(normalizeForgeQueueSettings('x')).toEqual(DEFAULT_FORGE_QUEUE_SETTINGS);
    expect(normalizeForgeQueueSettings([])).toEqual(DEFAULT_FORGE_QUEUE_SETTINGS);
  });

  it('keeps the switches it can read and defaults the ones it cannot', () => {
    expect(normalizeForgeQueueSettings({ stopWhenOutOfStones: 'no', scroll: true })).toEqual({
      ranges: [],
      stopWhenOutOfStones: true,
      scroll: true,
    });
  });

  it('drops a range that is not a whole level and a stone that does not exist', () => {
    const read = normalizeForgeQueueSettings({
      ranges: [
        { upTo: 10.5, rarity: 0 },
        { upTo: 12, rarity: 9 },
        { upTo: 13, rarity: 1 },
        'junk',
      ],
    });
    expect(read.ranges).toEqual([{ upTo: 15, rarity: 1 }]);
  });

  it('keeps at most four ranges, settled to run to +15', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ upTo: 6 + index, rarity: 0 }));
    const read = normalizeForgeQueueSettings({ ranges: many });
    expect(read.ranges.length).toBeLessThanOrEqual(4);
    expect(read.ranges.at(-1)?.upTo).toBe(15);
  });
});

describe('loading and saving the forge queue settings', () => {
  it('round-trips through local storage', () => {
    fakeStorage();
    const settings: ForgeQueueSettings = { ranges: [{ upTo: 15, rarity: 3 }], stopWhenOutOfStones: false, scroll: true };
    saveForgeQueueSettings(settings);
    expect(loadForgeQueueSettings()).toEqual(settings);
  });

  it('reads the default when nothing is stored, when the text is not JSON, and when storage is not there', () => {
    fakeStorage();
    expect(loadForgeQueueSettings()).toEqual(DEFAULT_FORGE_QUEUE_SETTINGS);
    fakeStorage('{not json');
    expect(loadForgeQueueSettings()).toEqual(DEFAULT_FORGE_QUEUE_SETTINGS);
    vi.unstubAllGlobals();
    expect(loadForgeQueueSettings()).toEqual(DEFAULT_FORGE_QUEUE_SETTINGS);
  });

  it('does not throw when storage refuses the write', () => {
    vi.stubGlobal('window', {
      localStorage: {
        setItem: () => {
          throw new Error('full');
        },
      },
    });
    expect(() => {
      saveForgeQueueSettings(DEFAULT_FORGE_QUEUE_SETTINGS);
    }).not.toThrow();
  });
});

describe('the forge queue settings store', () => {
  function memoryStore(initial: ForgeQueueSettings = DEFAULT_FORGE_QUEUE_SETTINGS) {
    const saved: ForgeQueueSettings[] = [];
    const store = createForgeQueueSettingsStore({
      load: () => initial,
      save: (settings) => saved.push(settings),
    });
    return { store, saved };
  }

  it('starts from what was saved and saves every change, telling its listeners', () => {
    const { store, saved } = memoryStore();
    const heard = vi.fn();
    store.subscribe(heard);
    store.setScroll(true);
    store.setStop(false);
    store.editStones({ kind: 'stoneRarity', index: 0, rarity: 2 });
    expect(store.get()).toEqual({ ranges: [{ upTo: 15, rarity: 2 }], stopWhenOutOfStones: false, scroll: true });
    expect(saved).toHaveLength(3);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('says nothing when a switch is set to the value it already has', () => {
    const { store, saved } = memoryStore();
    store.setScroll(false);
    store.setStop(true);
    expect(saved).toEqual([]);
  });
});
