import { describe, expect, it } from 'vitest';
import forgeWiki from '@bombfarm/domain/data/forge-wiki.json' with { type: 'json' };
import {
  FORGE_CHANCE,
  FORGE_CRITICAL,
  FORGE_ITEM_LEVELS,
  FORGE_MAX,
  FORGE_SAFE,
  forgeRollCost,
  forgeSafeJumpCost,
} from '@bombfarm/domain/forge';
import { FORJA_BONUS, upgradeMult } from '@bombfarm/domain/gear';

const ITEM_LEVEL_ROWS = 30;
const RARITIES = 6;
const TARGETS = 15;
const COST_CELLS = ITEM_LEVEL_ROWS * RARITIES * TARGETS;

function baseCost(level: number, rarity: number): number {
  return 120 + 8 * level + 100 * rarity;
}

function closedFormCost(level: number, rarity: number, target: number): number {
  return (baseCost(level, rarity) * (target + 1) ** 2) / 4;
}

describe('the committed forge cost table', () => {
  it('holds every one of the 2,700 cells to (120 + 8·level + 100·rarity) × (target + 1)² / 4', () => {
    const mismatches: string[] = [];
    let visited = 0;
    for (const row of forgeWiki.custo_por_nivel) {
      for (const byRarity of row.por_raridade) {
        byRarity.custos.forEach((cost, index) => {
          visited += 1;
          const target = index + 1;
          const expected = closedFormCost(row.nivel, byRarity.raridade, target);
          if (cost !== expected) {
            mismatches.push(
              `level ${row.nivel} rarity ${byRarity.raridade} +${target}: table ${cost}, closed form ${expected}`,
            );
          }
        });
      }
    }
    expect(visited).toBe(COST_CELLS);
    expect(mismatches).toEqual([]);
  });

  it('forgeRollCost returns the table cell itself for a level, rarity and target', () => {
    const [first] = forgeWiki.custo_por_nivel;
    const last = forgeWiki.custo_por_nivel[forgeWiki.custo_por_nivel.length - 1];
    expect(forgeRollCost(first.nivel, 0, 1)).toBe(first.por_raridade[0].custos[0]);
    expect(forgeRollCost(last.nivel, 5, 15)).toBe(last.por_raridade[5].custos[14]);
    expect(forgeRollCost(300, 5, 15)).toBe(193_280);
  });

  it('one safe jump costs the sum of the rolls for +1…+8, which is 71 × the base cost', () => {
    for (const level of FORGE_ITEM_LEVELS) {
      for (let rarity = 0; rarity < RARITIES; rarity++) {
        let summed = 0;
        for (let target = 1; target <= FORGE_SAFE; target++) summed += forgeRollCost(level, rarity, target);
        expect(forgeSafeJumpCost(level, rarity)).toBe(summed);
        expect(forgeSafeJumpCost(level, rarity)).toBe(71 * baseCost(level, rarity));
      }
    }
  });
});

describe('the forge bonus has one value across the domain', () => {
  it('the data file bonus equals FORJA_BONUS', () => {
    expect(forgeWiki.bonus).toBe(FORJA_BONUS);
  });

  it('upgrade_mult[n] equals upgradeMult(n) for every n in +0…+15', () => {
    expect(forgeWiki.upgrade_mult).toHaveLength(FORGE_MAX + 1);
    forgeWiki.upgrade_mult.forEach((mult, upgrade) => {
      expect(mult, `+${upgrade}`).toBe(upgradeMult(upgrade));
    });
  });
});

describe('the forge chance ladder', () => {
  it('carries one chance and one crit chance per target +1…+15', () => {
    expect(FORGE_CHANCE).toHaveLength(FORGE_MAX);
    expect(FORGE_CRITICAL).toHaveLength(FORGE_MAX);
  });

  it('is certain through +8 and never rises further up the ladder', () => {
    for (let target = 1; target <= FORGE_SAFE; target++) expect(FORGE_CHANCE[target - 1]).toBe(1);
    for (let index = 1; index < FORGE_CHANCE.length; index++) {
      expect(FORGE_CHANCE[index]).toBeLessThanOrEqual(FORGE_CHANCE[index - 1]);
    }
    expect(FORGE_CHANCE[FORGE_MAX - 1]).toBeLessThan(1);
  });

  it('cannot crit on the roll for +15', () => {
    expect(FORGE_CRITICAL[FORGE_MAX - 1]).toBe(0);
  });

  it('keeps +8 as the safe level and +15 as the top', () => {
    expect(FORGE_SAFE).toBe(8);
    expect(FORGE_MAX).toBe(15);
  });

  it('lists the item levels as the cost rows carry them, in order', () => {
    expect(FORGE_ITEM_LEVELS).toEqual(forgeWiki.custo_por_nivel.map((row) => row.nivel));
    expect(FORGE_ITEM_LEVELS).toHaveLength(ITEM_LEVEL_ROWS);
  });
});
