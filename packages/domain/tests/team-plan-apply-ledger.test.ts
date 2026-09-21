import { describe, expect, it } from 'vitest';
import { APPLY_CALL_MEAN_MS, computeApplyLedger } from '@bombfarm/domain/team-plan';
import { forgeForecast } from '@bombfarm/domain/forge';
import type { ApplyEquipUnit, ApplyPointsUnit } from '@bombfarm/contracts';

const ZERO_VECTOR = [0, 0, 0, 0, 0, 0, 0, 0] as const;

function equipUnit(index: number): ApplyEquipUnit {
  return {
    index,
    call: 'equip',
    itemId: `item-${String(index)}`,
    defId: `def-${String(index)}`,
    slot: 'weapon',
    fromHeroId: null,
    toHeroId: 'hero-x',
    displacesItemId: null,
    freedByIndex: null,
    pendingAt: [null],
    doneAt: ['hero-x'],
  };
}

function pointsUnit(index: number, heroId: string, needsRespec: boolean, respecGold: number): ApplyPointsUnit {
  return {
    index,
    heroId,
    level: 135,
    needsRespec,
    respecGold,
    vectorBefore: ZERO_VECTOR,
    vector: ZERO_VECTOR,
    pointsPlaced: 0,
  };
}

describe('computeApplyLedger — the hand-computed fixture', () => {
  const equipUnits = [equipUnit(0), equipUnit(1), equipUnit(2)];
  const pointsUnits = [pointsUnit(0, 'hero-respec', true, 135_000), pointsUnit(1, 'hero-plain', false, 0)];
  const forgeList = [
    { itemId: 'f1', defId: 'd1', from: 5, to: 10 },
    { itemId: 'f2', defId: 'd2', from: 8, to: 12 },
  ];
  const items = [
    { id: 'f1', upgrade: 5, level: 60, rarityIdx: 3 },
    { id: 'f2', upgrade: 8, level: 100, rarityIdx: 2 },
  ];

  const ledger = computeApplyLedger({ equipUnits, pointsUnits, forgeList, items, walletBefore: 200_000 });
  const expectedForgeGold =
    forgeForecast(5, 10, 60, 3).gold + forgeForecast(8, 12, 100, 2).gold;

  it('equip: calls 3, estimatedMs = calls × APPLY_CALL_MEAN_MS', () => {
    expect(ledger.equip.calls).toBe(3);
    expect(ledger.equip.estimatedMs).toBe(3 * APPLY_CALL_MEAN_MS);
  });

  it('points: calls 3 (2 for the respec unit, 1 for the plain unit), estimatedMs (calls + heroes) × mean, goldExact 135 000', () => {
    expect(ledger.points.heroes).toBe(2);
    expect(ledger.points.respecs).toBe(1);
    expect(ledger.points.calls).toBe(3);
    expect(ledger.points.estimatedMs).toBe((3 + 2) * APPLY_CALL_MEAN_MS);
    expect(ledger.points.goldExact).toBe(135_000);
  });

  it('forge.goldExpected sums forgeForecast over both priceable pieces', () => {
    expect(ledger.forge.pieces).toBe(2);
    expect(ledger.forge.goldExpected).toBe(expectedForgeGold);
  });

  it('totalGold and walletAfter', () => {
    const totalGold = 135_000 + expectedForgeGold;
    expect(ledger.totalGold).toBe(totalGold);
    expect(ledger.walletBefore).toBe(200_000);
    expect(ledger.walletAfter).toBe(200_000 - totalGold);
  });
});

describe('computeApplyLedger — forge.goldExpected is null when nothing prices', () => {
  const equipUnits: ApplyEquipUnit[] = [];
  const pointsUnits: ApplyPointsUnit[] = [];

  it('an empty forge list', () => {
    const ledger = computeApplyLedger({ equipUnits, pointsUnits, forgeList: [], items: [], walletBefore: 0 });
    expect(ledger.forge.goldExpected).toBeNull();
  });

  it('every row already at or above its target', () => {
    const ledger = computeApplyLedger({
      equipUnits,
      pointsUnits,
      forgeList: [{ itemId: 'f1', defId: 'd1', from: 10, to: 10 }],
      items: [{ id: 'f1', upgrade: 10, level: 60, rarityIdx: 0 }],
      walletBefore: 0,
    });
    expect(ledger.forge.goldExpected).toBeNull();
  });

  it('a level outside FORGE_ITEM_LEVELS', () => {
    const ledger = computeApplyLedger({
      equipUnits,
      pointsUnits,
      forgeList: [{ itemId: 'f1', defId: 'd1', from: 0, to: 5 }],
      items: [{ id: 'f1', upgrade: 0, level: 61, rarityIdx: 0 }],
      walletBefore: 0,
    });
    expect(ledger.forge.goldExpected).toBeNull();
  });

  it('ids absent from items', () => {
    const ledger = computeApplyLedger({
      equipUnits,
      pointsUnits,
      forgeList: [{ itemId: 'ghost', defId: 'd1', from: 0, to: 5 }],
      items: [],
      walletBefore: 0,
    });
    expect(ledger.forge.goldExpected).toBeNull();
  });

  it('partial pricing sums only the priceable rows', () => {
    const ledger = computeApplyLedger({
      equipUnits,
      pointsUnits,
      forgeList: [
        { itemId: 'priceable', defId: 'd1', from: 0, to: 5 },
        { itemId: 'unpriceable', defId: 'd2', from: 0, to: 5 },
      ],
      items: [
        { id: 'priceable', upgrade: 0, level: 60, rarityIdx: 0 },
        { id: 'unpriceable', upgrade: 0, level: 61, rarityIdx: 0 },
      ],
      walletBefore: 0,
    });
    expect(ledger.forge.goldExpected).toBe(forgeForecast(0, 5, 60, 0).gold);
  });
});

describe('computeApplyLedger — wallet and empty inputs', () => {
  it('walletAfter is null when walletBefore is null', () => {
    const ledger = computeApplyLedger({ equipUnits: [], pointsUnits: [], forgeList: [], items: [], walletBefore: null });
    expect(ledger.walletAfter).toBeNull();
  });

  it('empty inputs give zeros', () => {
    const ledger = computeApplyLedger({ equipUnits: [], pointsUnits: [], forgeList: [], items: [], walletBefore: 0 });
    expect(ledger.equip).toEqual({ calls: 0, estimatedMs: 0 });
    expect(ledger.points).toEqual({ heroes: 0, respecs: 0, calls: 0, estimatedMs: 0, goldExact: 0 });
    expect(ledger.forge).toEqual({ pieces: 0, goldExpected: null });
    expect(ledger.totalGold).toBe(0);
    expect(ledger.walletAfter).toBe(0);
  });
});
