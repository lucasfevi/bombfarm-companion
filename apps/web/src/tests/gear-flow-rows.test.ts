import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import {
  buildGearFlowRows,
  groupGearFlowRows,
  isKeptExistingGearFlowRow,
} from '@/features/team-plan/model/gear-flow-rows';

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'defId'>): InventoryItem {
  return {
    rarityIdx: 0,
    level: 70,
    upgrade: 10,
    slot: 'arma',
    equipped: Boolean(partial.equippedBy),
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
    ...partial,
  };
}

function emptyPlan(overrides: Partial<TeamPlan> = {}): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 0,
    slots: 6,
    currentDps: 0,
    planDps: 0,
    forgeFloorApplied: 0,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    disclosures: {
      unmodelledAbilities: [],
      loadoutDriftHeroNames: [],
      foreignOwnedItemCount: 0,
      marketBlockedItemCount: 0,
      unresolvedDefItemCount: 0,
    },
    run: {
      rounds: 0,
      evaluations: 0,
      budgetExhausted: false,
      elapsedMs: 0,
      seedUsed: 'current',
    },
    ...overrides,
  };
}

describe('buildGearFlowRows — kept existing items', () => {
  it('includes equipped pieces the plan never forges or moves', () => {
    const inventory = [
      item({ id: 'keep-1', defId: 'w1', equippedBy: 'hero-a', slot: 'arma', upgrade: 12 }),
      item({ id: 'spare-1', defId: 'w2', equippedBy: null, slot: 'arma' }),
    ];
    const rows = buildGearFlowRows(emptyPlan(), inventory);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      itemId: 'keep-1',
      originHeroId: 'hero-a',
      destHeroId: 'hero-a',
      forge: null,
    });
    expect(isKeptExistingGearFlowRow(rows[0]!)).toBe(true);
  });

  it('still emits forge-only keeps without marking them as unchanged', () => {
    const inventory = [
      item({ id: 'forge-1', defId: 'w1', equippedBy: 'hero-a', slot: 'arma', upgrade: 4 }),
    ];
    const rows = buildGearFlowRows(
      emptyPlan({
        forgeList: [{ itemId: 'forge-1', defId: 'w1', from: 4, to: 10 }],
      }),
      inventory,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.forge).toEqual({ from: 4, to: 10 });
    expect(isKeptExistingGearFlowRow(rows[0]!)).toBe(false);
  });

  it('does not double-count an item that both moves and was already equipped', () => {
    const inventory = [
      item({ id: 'move-1', defId: 'w1', equippedBy: 'hero-a', slot: 'arma' }),
    ];
    const rows = buildGearFlowRows(
      emptyPlan({
        moveList: [
          {
            phase: 'unequip',
            itemId: 'move-1',
            defId: 'w1',
            slot: 'arma',
            fromHeroId: 'hero-a',
            toHeroId: null,
          },
          {
            phase: 'equip',
            itemId: 'move-1',
            defId: 'w1',
            slot: 'arma',
            fromHeroId: 'hero-a',
            toHeroId: 'hero-b',
          },
        ],
      }),
      inventory,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      itemId: 'move-1',
      originHeroId: 'hero-a',
      destHeroId: 'hero-b',
    });
    expect(isKeptExistingGearFlowRow(rows[0]!)).toBe(false);
  });

  it('groups kept rows under the destination hero with moved rows', () => {
    const inventory = [
      item({ id: 'keep-1', defId: 'w1', equippedBy: 'hero-a', slot: 'arma' }),
      item({ id: 'in-1', defId: 'a1', equippedBy: null, slot: 'amuleto' }),
    ];
    const rows = buildGearFlowRows(
      emptyPlan({
        moveList: [
          {
            phase: 'equip',
            itemId: 'in-1',
            defId: 'a1',
            slot: 'amuleto',
            fromHeroId: null,
            toHeroId: 'hero-a',
          },
        ],
      }),
      inventory,
    );
    const groups = groupGearFlowRows(rows, ['hero-a']);
    expect(groups).toEqual([
      {
        heroId: 'hero-a',
        rows: expect.arrayContaining([
          expect.objectContaining({ itemId: 'keep-1' }),
          expect.objectContaining({ itemId: 'in-1' }),
        ]),
      },
    ]);
    expect(groups[0]?.rows).toHaveLength(2);
  });
});
