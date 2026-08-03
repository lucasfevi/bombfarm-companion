/**
 * BSPW5-08 (BSP-48/50/52, AD-BSP-25) — importHeroes as a full roster sync. AC-23...AC-28.
 * Isolation model: a per-file in-memory localStorage stub, same pattern as
 * storage-import-only.test.ts's memoryLocalStorage().
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveHeroId,
  importHeroes,
  loadHeroes,
  normalizeHero,
  saveHeroes,
  setActiveHeroId,
  type HeroRecord,
} from '@/shared/lib/storage';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

const emptySheet = {
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

const emptyLoadout = {
  arma: null,
  elmo: null,
  anel: null,
  amuleto: null,
  peito: null,
  calca: null,
  luva: null,
  bota: null,
};

function hero(id: string, sourceId: string, patch: Partial<HeroRecord> = {}): HeroRecord {
  return normalizeHero({
    id,
    name: sourceId,
    sourceId,
    updatedAt: 1,
    rarity: 'Raro',
    level: 1,
    stars: 0,
    naked: emptySheet,
    loadout: emptyLoadout,
    altLoadout: null,
    gearedOverride: emptySheet,
    abilities: {},
    pts: emptySheet,
    ...patch,
  });
}

/** A minimal `records` entry for importHeroes — an update/create input. */
function record(sourceId: string, patch: Partial<HeroRecord> = {}) {
  const { id: _id, updatedAt: _updatedAt, ...rest } = hero('ignored', sourceId, patch);
  return { ...rest, sourceId };
}

describe('importHeroes — full roster sync (BSPW5-08)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC-23/AC-24: a hero absent from saveSourceIds is removed in the same write as creates/updates; removed is exact', () => {
    saveHeroes([hero('a', 'save-a'), hero('b', 'save-b')]);
    const result = importHeroes(
      loadHeroes(),
      [record('save-a', { name: 'A Updated' }), record('save-c')],
      new Set(['save-a', 'save-c']),
    );
    expect(result.created).toBe(1); // save-c
    expect(result.updated).toBe(1); // save-a
    expect(result.removed).toBe(1); // save-b (absent from saveSourceIds)
    expect(result.heroes.map((h) => h.sourceId).sort()).toEqual(['save-a', 'save-c']);
  });

  it('DEC-06: removal is keyed off saveSourceIds, NEVER off records — a hero present in the set but absent from records survives untouched', () => {
    const existingB = hero('b', 'save-b', { name: 'Original B' });
    saveHeroes([hero('a', 'save-a'), existingB]);
    // save-b is in saveSourceIds (the save still reports it) but has no record this call
    // (e.g. its checkbox was deselected in the dialog, or it is a blocked candidate).
    const result = importHeroes(loadHeroes(), [record('save-a')], new Set(['save-a', 'save-b']));
    expect(result.removed).toBe(0);
    expect(result.updated).toBe(1); // only save-a
    const survivor = result.heroes.find((h) => h.sourceId === 'save-b');
    expect(survivor).toBeDefined();
    expect(survivor?.name).toBe('Original B'); // kept, not updated — byte-identical
    expect(survivor?.id).toBe('b');
  });

  it('AC-28: a blocked candidate (sourceId in the set, no record) is kept, not removed', () => {
    saveHeroes([hero('a', 'save-a'), hero('blocked-hero', 'save-blocked')]);
    // The blocked candidate contributes its sourceId to the set but no record (design.md).
    const result = importHeroes(loadHeroes(), [record('save-a')], new Set(['save-a', 'save-blocked']));
    expect(result.removed).toBe(0);
    expect(result.heroes.some((h) => h.sourceId === 'save-blocked')).toBe(true);
  });

  it('AC-26: one call both removes an absent hero and creates a new one', () => {
    saveHeroes([hero('stale', 'save-stale')]);
    const result = importHeroes(loadHeroes(), [record('save-new')], new Set(['save-new']));
    expect(result.created).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.heroes).toHaveLength(1);
    expect(result.heroes[0]?.sourceId).toBe('save-new');
  });

  it('BSP-52: every OTHER hero is left byte-identical apart from its own update, when one is removed and one is created', () => {
    const untouched = hero('untouched-id', 'save-untouched', { name: 'Untouched', level: 42 });
    saveHeroes([hero('stale-id', 'save-stale'), untouched]);
    const result = importHeroes(loadHeroes(), [record('save-new')], new Set(['save-new', 'save-untouched']));
    const survivor = result.heroes.find((h) => h.sourceId === 'save-untouched');
    expect(survivor).toEqual(untouched);
  });

  it('AC-25: active hero is re-pointed via reconcileActiveHero when it was removed', () => {
    saveHeroes([hero('a', 'save-a'), hero('b', 'save-b')]);
    setActiveHeroId('b');
    importHeroes(loadHeroes(), [record('save-a')], new Set(['save-a']));
    expect(getActiveHeroId()).toBe('a');
  });

  it('AC-25: active key is cleared when the roster becomes empty', () => {
    saveHeroes([hero('a', 'save-a')]);
    setActiveHeroId('a');
    importHeroes(loadHeroes(), [], new Set());
    expect(getActiveHeroId()).toBeNull();
  });

  it('active hero is left alone when nothing was removed', () => {
    saveHeroes([hero('a', 'save-a'), hero('b', 'save-b')]);
    setActiveHeroId('b');
    importHeroes(loadHeroes(), [record('save-a')], new Set(['save-a', 'save-b']));
    expect(getActiveHeroId()).toBe('b');
  });

  it('omitting saveSourceIds reproduces today\'s exact behavior — create/update only, removed is always 0', () => {
    saveHeroes([hero('a', 'save-a'), hero('b', 'save-b')]);
    // records is a strict SUBSET of the existing roster (save-b is not part of this call at
    // all) — with no third argument, save-b must NOT be removed (no src/features/** caller
    // passes the third parameter yet).
    const result = importHeroes(loadHeroes(), [record('save-a', { name: 'A2' }), record('save-c')]);
    expect(result.removed).toBe(0);
    expect(result.heroes.map((h) => h.sourceId).sort()).toEqual(['save-a', 'save-b', 'save-c']);
  });

  it('the whole heroes[] being empty removes every existing hero (deliberate, spec.md edge case)', () => {
    saveHeroes([hero('a', 'save-a'), hero('b', 'save-b')]);
    const result = importHeroes(loadHeroes(), [], new Set());
    expect(result.removed).toBe(2);
    expect(result.heroes).toHaveLength(0);
  });

  it('AC-27: the sync mechanism never reads account_id or generated_at (source inspection — importHeroes takes no such input)', () => {
    const content = readFileSync(join(process.cwd(), 'src/shared/lib/storage.ts'), 'utf8');
    expect(content).not.toMatch(/account_id/);
    expect(content).not.toMatch(/generated_at/);
  });

  it('AC-27 (behavioral): two calls with the same heroes/records/sourceIds produce identical results regardless of any unrelated caller-side metadata', () => {
    saveHeroes([hero('a', 'save-a')]);
    const before = loadHeroes();
    const resultOld = importHeroes(before, [record('save-b')], new Set(['save-a', 'save-b']));
    saveHeroes([hero('a', 'save-a')]);
    const resultNew = importHeroes(loadHeroes(), [record('save-b')], new Set(['save-a', 'save-b']));
    expect(resultNew.created).toBe(resultOld.created);
    expect(resultNew.updated).toBe(resultOld.updated);
    expect(resultNew.removed).toBe(resultOld.removed);
  });
});
