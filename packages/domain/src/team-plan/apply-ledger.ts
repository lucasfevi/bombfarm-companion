import type { ApplyEquipUnit, ApplyPointsUnit } from '@bombfarm/contracts';
import { forgeForecast } from '../forge/forecast';
import { FORGE_ITEM_LEVELS } from '../forge/rules';
import type { ForgeAction } from './types';

// Unmeasured: the 1.5s write floor (minWriteGapMs) against the humanised 0.7-2.5s gap between
// calls, with an 8% chance of a 4-12s long pause, works out to roughly a 2.2s mean gap; adding
// request time lands here. Reads share the same pacing chain, so a cycle can slot between calls.
export const APPLY_CALL_MEAN_MS = 2_500;

export function estimateApplyDurationMs(calls: number): number {
  return calls * APPLY_CALL_MEAN_MS;
}

export type ApplyLedger = {
  equip: { calls: number; estimatedMs: number };
  forge: { pieces: number; goldExpected: number | null };
  points: { heroes: number; respecs: number; calls: number; estimatedMs: number; goldExact: number };
  totalGold: number;
  walletBefore: number | null;
  walletAfter: number | null;
};

export function computeApplyLedger(input: {
  equipUnits: readonly ApplyEquipUnit[];
  pointsUnits: readonly ApplyPointsUnit[];
  forgeList: readonly ForgeAction[];
  items: ReadonlyArray<{ id: string; upgrade: number; level: number; rarityIdx: number }>;
  walletBefore: number | null;
}): ApplyLedger {
  const equipCalls = input.equipUnits.length;

  const heroes = input.pointsUnits.length;
  const respecs = input.pointsUnits.filter((unit) => unit.needsRespec).length;
  const pointsCalls = input.pointsUnits.reduce((sum, unit) => sum + (unit.needsRespec ? 2 : 1), 0);
  const goldExact = input.pointsUnits.reduce((sum, unit) => sum + unit.respecGold, 0);

  const itemById = new Map(input.items.map((item) => [item.id, item]));
  let forgeGoldSum = 0;
  let anyPriced = false;
  for (const action of input.forgeList) {
    const item = itemById.get(action.itemId);
    if (!item) continue;
    if (!FORGE_ITEM_LEVELS.includes(item.level)) continue;
    if (item.upgrade >= action.to) continue;
    forgeGoldSum += forgeForecast(item.upgrade, action.to, item.level, item.rarityIdx).gold;
    anyPriced = true;
  }
  const goldExpected = anyPriced ? forgeGoldSum : null;

  const totalGold = goldExact + (goldExpected ?? 0);

  return {
    equip: { calls: equipCalls, estimatedMs: estimateApplyDurationMs(equipCalls) },
    forge: { pieces: input.forgeList.length, goldExpected },
    points: {
      heroes,
      respecs,
      calls: pointsCalls,
      estimatedMs: (pointsCalls + heroes) * APPLY_CALL_MEAN_MS,
      goldExact,
    },
    totalGold,
    walletBefore: input.walletBefore,
    walletAfter: input.walletBefore === null ? null : input.walletBefore - totalGold,
  };
}
