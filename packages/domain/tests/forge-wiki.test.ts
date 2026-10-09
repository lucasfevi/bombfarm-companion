import { describe, expect, it } from 'vitest';
import forgeWiki from '@bombfarm/domain/data/forge-wiki.json' with { type: 'json' };
import {
  FORGE_CHANCE,
  FORGE_CRITICAL,
  FORGE_FAIL_FLOOR,
  FORGE_FAIL_LEVEL,
  FORGE_GUARANTEED,
  FORGE_ITEM_LEVELS,
  FORGE_MAX,
  FORGE_PITY_STEP,
  forgeChance,
  forgeRollCost,
  forgeRollEssence,
  forgeScrollCost,
} from '@bombfarm/domain/forge';
import { upgradeMult } from '@bombfarm/domain/gear';

const ITEM_LEVEL_ROWS = 30;
const TARGETS = 15;
const COST_CELLS = ITEM_LEVEL_ROWS * 6 * TARGETS;

function baseCost(level: number, rarity: number): number {
  return 120 + 8 * level + 100 * rarity;
}

function closedFormCost(level: number, rarity: number, target: number): number {
  return (baseCost(level, rarity) * (target + 1) ** 2) / 4;
}

describe('the committed forge cost table', () => {
  it('holds every one of the 2,700 gold cells to (120 + 8·level + 100·rarity) × (target + 1)² / 4', () => {
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

  it('holds every one of the 2,700 essence cells to essencia_k × (rarity + 1) × level / essencia_div, rounded up', () => {
    const mismatches: string[] = [];
    for (const row of forgeWiki.custo_por_nivel) {
      for (const byRarity of row.por_raridade) {
        expect(byRarity.essencia).toHaveLength(TARGETS);
        byRarity.essencia.forEach((essence, index) => {
          const expected = Math.ceil((forgeWiki.essencia_k[index] * (byRarity.raridade + 1) * row.nivel) / forgeWiki.essencia_div);
          if (essence !== expected) mismatches.push(`level ${row.nivel} rarity ${byRarity.raridade} +${index + 1}`);
        });
      }
    }
    expect(mismatches).toEqual([]);
    expect(forgeRollEssence(300, 5, 15)).toBe(360);
    expect(forgeRollEssence(10, 5, 3)).toBe(0);
    expect(forgeRollEssence(10, 0, 10)).toBe(2);
  });

  it('holds the scroll price to base[target] × (rarity + 1) × level / 10 in every published example', () => {
    const { alvos, exemplos } = forgeWiki.ajudas.pergaminho;
    const [base] = exemplos;
    for (const example of exemplos) {
      alvos.forEach((target, index) => {
        expect(example.custos[index]).toBe((base.custos[index] * (example.raridade + 1) * example.nivel) / 10);
        expect(forgeScrollCost(example.nivel, example.raridade, target)).toBe(example.custos[index]);
      });
    }
  });
});

describe('the forge bonus has one value across the domain', () => {
  it('bonus_acum is upgrade_mult less the base item', () => {
    forgeWiki.bonus_acum.forEach((bonus, upgrade) => {
      expect(bonus, `+${upgrade}`).toBeCloseTo(forgeWiki.upgrade_mult[upgrade] - 1, 9);
    });
  });

  it('upgrade_mult[n] equals upgradeMult(n) for every n in +0…+15', () => {
    expect(forgeWiki.upgrade_mult).toHaveLength(FORGE_MAX + 1);
    forgeWiki.upgrade_mult.forEach((mult, upgrade) => {
      expect(mult, `+${upgrade}`).toBe(upgradeMult(upgrade));
    });
  });
});

describe('the forge chance ladder', () => {
  it('carries one chance, one crit chance and one landing level per target +1…+15', () => {
    expect(FORGE_CHANCE).toHaveLength(FORGE_MAX);
    expect(FORGE_CRITICAL).toHaveLength(FORGE_MAX);
    expect(FORGE_FAIL_LEVEL).toHaveLength(FORGE_MAX);
  });

  it('is certain through +4 and never rises further up the ladder', () => {
    for (let target = 1; target <= FORGE_GUARANTEED; target++) expect(FORGE_CHANCE[target - 1]).toBe(1);
    for (let index = 1; index < FORGE_CHANCE.length; index++) {
      expect(FORGE_CHANCE[index]).toBeLessThanOrEqual(FORGE_CHANCE[index - 1]);
    }
    expect(FORGE_CHANCE[FORGE_GUARANTEED]).toBeLessThan(1);
  });

  it('cannot crit on the roll for +15', () => {
    expect(FORGE_CRITICAL[FORGE_MAX - 1]).toBe(0);
  });

  it('keeps +15 as the top, +4 as the last certain rung, +10 as the floor and five points of pity', () => {
    expect(FORGE_MAX).toBe(15);
    expect(FORGE_GUARANTEED).toBe(4);
    expect(FORGE_FAIL_FLOOR).toBe(10);
    expect(FORGE_PITY_STEP).toBe(0.05);
  });

  it('keeps the level through +11 and lands a miss one level down from +12, never under the floor', () => {
    FORGE_FAIL_LEVEL.forEach((landing, index) => {
      expect(landing).toBe(index <= FORGE_FAIL_FLOOR ? index : index - 1);
      expect(landing).toBeGreaterThanOrEqual(Math.min(index, FORGE_FAIL_FLOOR));
    });
  });

  it('prints the published pity example for a +15 roll', () => {
    const { alvo, chances } = forgeWiki.pity_exemplo;
    chances.forEach((chance, misses) => {
      expect(forgeChance(alvo, misses)).toBeCloseTo(chance, 12);
    });
  });

  it('lists the item levels as the cost rows carry them, in order', () => {
    expect(FORGE_ITEM_LEVELS).toEqual(forgeWiki.custo_por_nivel.map((row) => row.nivel));
    expect(FORGE_ITEM_LEVELS).toHaveLength(ITEM_LEVEL_ROWS);
  });
});
