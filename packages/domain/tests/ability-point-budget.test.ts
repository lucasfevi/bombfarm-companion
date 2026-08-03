import { describe, expect, it } from 'vitest';
import { ABILITY_LEVEL_MAX, ABILITY_QUOTA, abilityPointBudget } from '@/shared/domain/model';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const RARITY_BY_IDX = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'] as const;

describe('abilityPointBudget (BSPW3-11, AD-BSP-23)', () => {
  it('AC-23: returns min(level, quota x 20) — the old quota x max formula is wrong on both axes', () => {
    expect(ABILITY_LEVEL_MAX).toBe(20);
    // Below the slot cap: level is the binding constraint.
    expect(abilityPointBudget('Lendária', 10)).toBe(10);
    // Above the slot cap: quota x 20 is the binding constraint.
    expect(abilityPointBudget('Lendária', 200)).toBe(ABILITY_QUOTA.Lendária * 20);
    expect(abilityPointBudget('Lendária', 200)).toBe(100);
  });

  // AC-23a — boundary cases from bellatrix-02-pts-each-1.json, asserted by name.
  it.each([
    { hero: 'Bram', level: 49, rarity: 'Incomum', quota: 2, spendable: 40, dead: 9 },
    { hero: 'Torin', level: 45, rarity: 'Incomum', quota: 2, spendable: 40, dead: 5 },
    { hero: 'Bellatrix', level: 59, rarity: 'Raro', quota: 3, spendable: 59, dead: 0 },
  ] as const)(
    'AC-23a: $hero L$level $rarity -> spendable $spendable, $dead dead',
    ({ level, rarity, quota, spendable, dead }) => {
      expect(ABILITY_QUOTA[rarity]).toBe(quota);
      const budget = abilityPointBudget(rarity, level);
      expect(budget).toBe(spendable);
      expect(level - budget).toBe(dead);
    },
  );

  it('AC-23a: a Mítico hero at L100 needs 120 points but the level cap allows only 100 (AD-BSP-23a)', () => {
    expect(ABILITY_QUOTA.Mítico).toBe(6);
    const needed = ABILITY_QUOTA.Mítico * ABILITY_LEVEL_MAX;
    expect(needed).toBe(120);
    const budget = abilityPointBudget('Mítico', 100);
    expect(budget).toBe(100);
    expect(needed - budget).toBe(20); // unreachable even with every slot maxed
  });

  it('AC-23b: spent === min(level, quota x 20) holds 11/11 on the fixture (equality, not <=)', () => {
    const raw = loadFixtureJson('bellatrix-02-pts-each-1.json');
    const heroes = raw.heroes as Array<Record<string, unknown>>;
    expect(heroes.length).toBe(11);

    for (const hero of heroes) {
      const name = hero.name as string;
      const level = hero.level as number;
      const rarityIdx = hero.rarity as number;
      const rarity = RARITY_BY_IDX[rarityIdx];
      const spent = hero.ability_points_spent as number;
      const budget = abilityPointBudget(rarity, level);

      expect(spent, `${name}: spent <= budget`).toBeLessThanOrEqual(budget);
      expect(spent, `${name}: spent === budget (equality)`).toBe(budget);
    }
  });
});
