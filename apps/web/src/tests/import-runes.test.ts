/**
 * What the player sees of runes on the planner: an account read whose runed heroes used to be
 * blocked from import (their rune bonus charged to spent points, the budget overshot) now
 * imports every hero, keeps each hero's runes on the stored record, and refreshes them on the
 * next import — a rune expires, and the roster must not keep one the game no longer reports.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { runesOf } from '@bombfarm/domain/runes';
import { importHeroes, loadHeroes, normalizeHero } from '@/shared/lib/storage';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FILE = 'payload-20260913-20heroes-runes.json';

function memoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

function importable() {
  const parsed = parseSaveFile(loadFixtureJson(FILE), []);
  expect(parsed.rejected).toBeNull();
  const records = parsed.candidates
    .filter((candidate) => !candidate.blocked)
    .map((candidate) => ({ ...candidate.record, sourceId: candidate.sourceId }));
  return { parsed, records, saveSourceIds: new Set(parsed.candidates.map((c) => c.sourceId)) };
}

describe('importing the 2026-09-13 live read with runed heroes', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('every one of the twenty heroes imports — none is blocked any more', () => {
    const { parsed, records, saveSourceIds } = importable();
    expect(parsed.candidates.filter((c) => c.blocked)).toEqual([]);
    const { heroes, created } = importHeroes([], records, saveSourceIds);
    expect(created).toBe(20);
    expect(heroes).toHaveLength(20);
  });

  it('keeps each hero\'s runes on the stored record, and an empty list on the rest', () => {
    const { records, saveSourceIds } = importable();
    importHeroes([], records, saveSourceIds);
    const stored = loadHeroes();
    const runed = stored.filter((hero) => runesOf(hero).length > 0).map((hero) => hero.name);
    expect(runed).toEqual(['Jon', 'WB;KE', 'Bellatrix', 'Minato', 'Edda', 'Korin']);
    for (const hero of stored) expect(hero.runes, hero.name).toBeDefined();
    const bellatrix = stored.find((hero) => hero.name === 'Bellatrix')!;
    expect(runesOf(bellatrix)).toHaveLength(8);
    expect(runesOf(bellatrix)[0]).toEqual({ axis: 'critdmg', strengthPct: 5, playSecondsLeft: 65365, rarity: 0 });
  });

  it('a re-import replaces the runes with what the read carries now — an expired rune does not linger', () => {
    const { records, saveSourceIds } = importable();
    const first = importHeroes([], records, saveSourceIds).heroes;
    const jonBefore = first.find((hero) => hero.name === 'Jon')!;
    expect(runesOf(jonBefore)).toHaveLength(1);

    const expired = parseSaveFile(
      {
        ...loadFixtureJson(FILE),
        heroes: (loadFixtureJson(FILE).heroes as Record<string, unknown>[]).map((hero) =>
          hero.name === 'Jon' ? { ...hero, runas: null, stats: { ...(hero.stats as object), dmg: (hero.stats as { dmg: number }).dmg / 1.05 } } : hero,
        ),
      },
      first,
    );
    const again = importHeroes(
      first,
      expired.candidates.filter((c) => !c.blocked).map((c) => ({ ...c.record, sourceId: c.sourceId })),
      saveSourceIds,
    ).heroes;
    const jonAfter = again.find((hero) => hero.name === 'Jon')!;
    expect(jonAfter.id).toBe(jonBefore.id);
    expect(runesOf(jonAfter)).toEqual([]);
    expect(jonAfter.pts).toEqual(jonBefore.pts);
    expect(jonAfter.gearedOverride.attack).toBeCloseTo(jonBefore.gearedOverride.attack / 1.05, 6);
  });

  it('a record stored before runes existed loads without gaining the field', () => {
    const hero = normalizeHero({ id: 'h1', name: 'Old', sourceId: 'src-1' });
    expect('runes' in hero && hero.runes !== undefined).toBe(false);
    expect(runesOf(hero)).toEqual([]);
  });
});
