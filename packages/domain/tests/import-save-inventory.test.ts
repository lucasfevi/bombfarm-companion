import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';
import { minimalHero } from './helpers/minimal-save-hero';

/**
 * The minimal `skills` shape that satisfies `parseSaveFile`'s positive discriminator
 * — presence of `refunds`/`vagas_campo`/`bag_tabs_bonus` only, no other content. Every
 * inline literal below that used to omit `skills` entirely now carries this, or the whole file
 * (not just the item/hero under test) would reject before this suite's own assertions run.
 */
const POST_PATCH_SKILLS = { refunds: {}, totals: { vagas_campo: 0, bag_tabs_bonus: 0 } };

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
  // F1 (ground-truth-rule class (a) — read from the capture): re-pointed onto payload-20260812-8heroes
  // for its larger, richer inventory (27 catalogued vs the export's 17).
  it('payload-20260812-8heroes: gear, equipped, spare, histogram, and slots', () => {
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const { inventory, account, rejected } = parseSaveFile(raw, []);
    expect(rejected).toBeNull();
    expect(inventory).toHaveLength(27);
    expect(inventory.filter((item) => item.equipped)).toHaveLength(23);
    expect(inventory.filter((item) => !item.equipped)).toHaveLength(4);
    expect(categoryHistogram(raw)).toEqual({ 0: 27, 4: 3 });
    expect(account.slots).toBe(3);
  });

  // F1 (ground-truth-rule class (a)): re-pointed onto save-20260813-5heroes (the export).
  it('save-20260813-5heroes: gear, equipped, and spare counts', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const { inventory, rejected } = parseSaveFile(raw, []);
    expect(rejected).toBeNull();
    expect(inventory).toHaveLength(17);
    expect(inventory.filter((item) => item.equipped)).toHaveLength(12);
    expect(inventory.filter((item) => !item.equipped)).toHaveLength(5);
  });

  it('missing items array yields empty inventory and keeps the existing warning', () => {
    const { inventory, warnings } = parseSaveFile({ heroes: [], skills: POST_PATCH_SKILLS }, []);
    expect(inventory).toEqual([]);
    expect(warnings.some((warning) => warning.includes('no "items" list'))).toBe(true);
  });

  it('warns about unequipped items with unresolvable def_id but still records them', () => {
    const { inventory, warnings } = parseSaveFile(
      {
        heroes: [minimalHero('1')],
        skills: POST_PATCH_SKILLS,
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
        skills: POST_PATCH_SKILLS,
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

  // Re-pointed off `save-20260813-5heroes.json` (issue #206): that capture is behind the
  // stat-point budget refusal, so 2 of its 5 heroes come through blocked and the "nothing is
  // blocked" half of this claim describes a roster the importer no longer produces. The 2026-08-19
  // capture parses 7 of 7 clean, which is what makes the claim assertable again rather than
  // merely re-recorded.
  it('does not change hero candidate count on the real fixture', () => {
    const raw = loadFixtureJson('save-20260819-11882-7heroes.json');
    const withoutInventory = parseSaveFile(raw, []);
    expect(withoutInventory.candidates.length).toBe(7);
    expect(withoutInventory.candidates.every((candidate) => !candidate.blocked)).toBe(true);
  });

  it('equipped unresolvable gear still blocks the owning hero', () => {
    const { candidates } = parseSaveFile(
      {
        heroes: [minimalHero('hero-1', 'Blocked')],
        skills: POST_PATCH_SKILLS,
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
    const { account } = parseSaveFile({ heroes: [], skills: POST_PATCH_SKILLS }, []);
    expect(account.slots).toBeUndefined();
  });

  it('inventory entries carry catalog-resolved slots', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
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
