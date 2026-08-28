import { describe, expect, it } from 'vitest';
import { ABILITY_LEVEL_MAX, ABILITY_QUOTA, abilityPointBudget } from '@bombfarm/domain/model';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const RARITY_BY_IDX = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'] as const;

describe('abilityPointBudget', () => {
  it('returns min(level, quota x 20) — the old quota x max formula is wrong on both axes', () => {
    expect(ABILITY_LEVEL_MAX).toBe(20);
    // Below the slot cap: level is the binding constraint.
    expect(abilityPointBudget('Lendária', 10)).toBe(10);
    // Above the slot cap: quota x 20 is the binding constraint.
    expect(abilityPointBudget('Lendária', 200)).toBe(ABILITY_QUOTA.Lendária * 20);
    expect(abilityPointBudget('Lendária', 200)).toBe(100);
  });

  // Boundary cases, re-pointed onto the post-patch corpus (the ground-truth rule class
  // (a) — read from the capture). RECORDED LOSS: the deleted `Bram L49 -> 40 spendable / 9
  // dead` and `Torin L45 -> 40 / 5` rows named heroes of the deleted account whose level
  // exceeded `quota × 20` (the "dead point" boundary). No hero on either post-patch corpus
  // file exceeds that boundary — every row below has `dead: 0`. The dead-point boundary case
  // itself is lost (see docs/fixture-corpus.md); the synthetic Mítico L100 case below still
  // demonstrates the boundary math directly.
  it.each([
    { hero: 'Jon (export)', level: 38, rarity: 'Incomum', quota: 2, spendable: 38, dead: 0 },
    { hero: 'Bellatrix (export)', level: 42, rarity: 'Raro', quota: 3, spendable: 42, dead: 0 },
    { hero: 'Nyx (payload)', level: 25, rarity: 'Incomum', quota: 2, spendable: 25, dead: 0 },
  ] as const)(
    '$hero L$level $rarity -> spendable $spendable, $dead dead',
    ({ level, rarity, quota, spendable, dead }) => {
      expect(ABILITY_QUOTA[rarity]).toBe(quota);
      const budget = abilityPointBudget(rarity, level);
      expect(budget).toBe(spendable);
      expect(level - budget).toBe(dead);
    },
  );

  it('a Mítico hero at L100 needs 120 points but the level cap allows only 100', () => {
    expect(ABILITY_QUOTA.Mítico).toBe(6);
    const needed = ABILITY_QUOTA.Mítico * ABILITY_LEVEL_MAX;
    expect(needed).toBe(120);
    const budget = abilityPointBudget('Mítico', 100);
    expect(budget).toBe(100);
    expect(needed - budget).toBe(20); // unreachable even with every slot maxed
  });

  it('spent === min(level, quota x 20) holds 13/13 across both post-patch corpus files (equality, not <=)', () => {
    // (the ground-truth rule class (a) — read from the capture): re-pointed onto both corpus files
    // combined (5 export heroes + 8 payload heroes). The hero count is read from the two
    // fixtures, not hand-copied — 13, verified against packages/domain/tests/point-roundtrip.test.ts's
    // own independently-measured 13-hero floor.
    const exportRaw = loadFixtureJson('save-20260813-5heroes.json');
    const payloadRaw = loadFixtureJson('payload-20260812-8heroes.json');
    const heroes = [
      ...(exportRaw.heroes as Array<Record<string, unknown>>),
      ...(payloadRaw.heroes as Array<Record<string, unknown>>),
    ];
    expect(heroes.length, 'expected 13 heroes across save-20260813-5heroes.json + payload-20260812-8heroes.json').toBe(13);

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
