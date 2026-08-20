import { describe, expect, it } from 'vitest';
import catalog from '@bombfarm/domain/data/catalog.json';
import { ITEM_LEVELS, setsForLevel } from '@bombfarm/domain/gear';

/**
 * `catalog.setsByLevel` maps each native item level to a LIST of sets, but every list today holds
 * exactly one entry, and no set is reachable from two levels. Two shipped behaviours depend on
 * that being a data fact rather than a coincidence:
 *
 * - `patchSlot` (`src/loadout.ts`) and the planner's slot editor both take `setsForLevel(level)[0]`
 *   and never look at the rest of the array.
 * - The slot editor prints the set name inside the LEVEL option's own label (#106) — there is no
 *   separate set control any more, so a level that mapped to two sets would render a label that is
 *   wrong for one of them and leave the second set unpickable, with no build or runtime error.
 *
 * A game patch re-keys these levels wholesale (2026-08-15 moved every one of them), so this is the
 * check that makes the next re-key fail here instead of shipping a quietly wrong UI. `setsForLevel`
 * keeps its array return type deliberately — the shape is what makes this assertable.
 */
describe('catalog.setsByLevel is a level↔set bijection', () => {
  const entries = Object.entries(catalog.setsByLevel as Record<string, string[]>);

  it('non-vacuity: every catalog level has an entry, and there is more than a handful', () => {
    expect(entries.length, 'setsByLevel entry count').toBeGreaterThan(20);
    expect(entries.length, 'one entry per catalog level').toBe(ITEM_LEVELS.length);
    const missing = ITEM_LEVELS.filter((level) => setsForLevel(level).length === 0);
    expect(missing, 'catalog levels setsForLevel resolves to nothing').toEqual([]);
  });

  it('every level maps to exactly one set', () => {
    const offenders = entries.filter(([, sets]) => sets.length !== 1).map(([level]) => level);
    expect(offenders, 'levels mapping to zero or several sets').toEqual([]);
    expect(Object.values(catalog.setsByLevel as Record<string, string[]>).every((s) => s.length === 1)).toBe(true);
  });

  it('no set is shared between two levels', () => {
    const sets = entries.map(([, setsForThisLevel]) => setsForThisLevel[0]);
    expect(new Set(sets).size, 'distinct set names vs level count').toBe(entries.length);
  });

  it('every def belongs to a set the map reaches from its own native level', () => {
    expect(catalog.defs.length, 'catalog def count').toBeGreaterThan(200);
    const orphaned = catalog.defs.filter((def) => setsForLevel(def.nativeLevel)[0] !== def.set);
    expect(
      orphaned.map((def) => def.id),
      'defs whose set is not the one setsForLevel returns for their native level',
    ).toEqual([]);
  });
});
