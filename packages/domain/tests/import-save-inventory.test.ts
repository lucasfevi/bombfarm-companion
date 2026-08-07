import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';
import { minimalHero } from './helpers/minimal-save-hero';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function categoryHistogram(raw: unknown): Record<number, number> {
  const items = isObject(raw) && Array.isArray(raw.items) ? raw.items : [];
  const hist: Record<number, number> = {};
  for (const item of items) {
    if (!isObject(item)) continue;
    const category = Math.round(Number(item.category));
    hist[category] = (hist[category] ?? 0) + 1;
  }
  return hist;
}

describe('parseSaveFile inventory pass', () => {
  it('save-20260731-11heroes: gear, equipped, spare, histogram, and slots', () => {
    const raw = loadFixtureJson('save-20260731-11heroes.json');
    const { inventory, account, rejected } = parseSaveFile(raw, []);
    expect(rejected).toBeNull();
    expect(inventory).toHaveLength(58);
    expect(inventory.filter((item) => item.equipped)).toHaveLength(44);
    expect(inventory.filter((item) => !item.equipped)).toHaveLength(14);
    expect(categoryHistogram(raw)).toEqual({ 0: 58, 1: 12, 2: 19, 3: 5, 4: 80 });
    expect(account.slots).toBe(6);
  });

  it('save-20260801-crit-dmg-tree: gear, equipped, and spare counts', () => {
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const { inventory, rejected } = parseSaveFile(raw, []);
    expect(rejected).toBeNull();
    expect(inventory).toHaveLength(83);
    expect(inventory.filter((item) => item.equipped)).toHaveLength(64);
    expect(inventory.filter((item) => !item.equipped)).toHaveLength(19);
  });

  it('missing items array yields empty inventory and keeps the existing warning', () => {
    const { inventory, warnings } = parseSaveFile({ heroes: [] }, []);
    expect(inventory).toEqual([]);
    expect(warnings.some((warning) => warning.includes('no "items" list'))).toBe(true);
  });

  it('warns about unequipped items with unresolvable def_id but still records them', () => {
    const { inventory, warnings } = parseSaveFile(
      {
        heroes: [minimalHero('1')],
        items: [
          {
            category: 0,
            id: 'bad1',
            def_id: 'not_in_catalog',
            rarity: 0,
            level: 10,
            upgrade: 0,
            equipped_on: '',
            market_state: 0,
          },
        ],
      },
      [],
    );
    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.defResolved).toBe(false);
    expect(warnings.some((warning) => warning.includes('unequipped gear item'))).toBe(true);
  });

  it('warns when market_state is not zero', () => {
    const { warnings } = parseSaveFile(
      {
        heroes: [minimalHero('1')],
        items: [
          {
            category: 0,
            id: 'm1',
            def_id: 'ember_calca',
            rarity: 2,
            level: 10,
            upgrade: 0,
            equipped_on: '',
            market_state: 1,
          },
        ],
      },
      [],
    );
    expect(warnings.some((warning) => warning.includes('market-blocked'))).toBe(true);
  });

  it('does not change hero candidate count on the real fixture', () => {
    const raw = loadFixtureJson('save-20260731-11heroes.json');
    const withoutInventory = parseSaveFile(raw, []);
    expect(withoutInventory.candidates.length).toBeGreaterThan(0);
    expect(withoutInventory.candidates.every((candidate) => !candidate.blocked)).toBe(true);
  });

  it('equipped unresolvable gear still blocks the owning hero', () => {
    const { candidates } = parseSaveFile(
      {
        heroes: [minimalHero('hero-1', 'Blocked')],
        items: [
          {
            category: 0,
            id: 'eq1',
            def_id: 'not_in_catalog',
            rarity: 0,
            level: 10,
            upgrade: 0,
            equipped_on: 'hero-1',
            market_state: 0,
          },
        ],
      },
      [],
    );
    expect(candidates[0]?.blocked).toBe(true);
  });

  it('account.slots is undefined when casa is absent', () => {
    const { account } = parseSaveFile({ heroes: [] }, []);
    expect(account.slots).toBeUndefined();
  });

  it('inventory entries carry catalog-resolved slots', () => {
    const raw = loadFixtureJson('save-20260731-11heroes.json');
    const { inventory } = parseSaveFile(raw, []);
    const emberCalca = inventory.find((item) => item.defId === 'ember_calca' && item.upgrade === 8);
    expect(emberCalca?.slot).toBe('calca');
  });

  it('rejected saves still return an empty inventory array', () => {
    const { inventory, rejected } = parseSaveFile({ not_a_save: true }, []);
    expect(rejected?.reason).toBe('notASaveFile');
    expect(inventory).toEqual([]);
  });
});
