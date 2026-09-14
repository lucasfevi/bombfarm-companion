import {
  FORGE_ITEM_LEVELS,
  FORGE_MAX,
  FORGE_SAFE,
  forgeChance,
  forgeFailFloor,
  forgeForecast,
  type ForgeForecast,
} from '@bombfarm/domain/forge';
import type { GearFlowRow } from './gear-flow-rows';

/** One rung of an item's ladder, +1 through +15. */
export type ForgeLadderRung =
  | { target: number; kind: 'held' }
  | { target: number; kind: 'safe' }
  | { target: number; kind: 'roll'; chance: number; failTo: number }
  | { target: number; kind: 'beyond' };

export type ForgeQueueEntry = {
  row: GearFlowRow;
  from: number;
  to: number;
  rungs: ForgeLadderRung[];
  /** Null when the item's level has no row on the forge table, so nothing can be priced. */
  forecast: ForgeForecast | null;
};

export type ForgeQueue = {
  entries: ForgeQueueEntry[];
  /** Summed over the entries that could be priced; null when none could. */
  total: ForgeForecast | null;
};

export function forgeLadderRungs(from: number, to: number): ForgeLadderRung[] {
  return Array.from({ length: FORGE_MAX }, (_, index) => {
    const target = index + 1;
    if (target <= from) return { target, kind: 'held' };
    if (target > to) return { target, kind: 'beyond' };
    if (target <= FORGE_SAFE) return { target, kind: 'safe' };
    return { target, kind: 'roll', chance: forgeChance(target), failTo: forgeFailFloor(target) };
  });
}

function forecastFor(row: GearFlowRow, from: number, to: number): ForgeForecast | null {
  if (!FORGE_ITEM_LEVELS.includes(row.level)) return null;
  return forgeForecast(from, to, row.level, row.rarityIdx);
}

/** The forge chores among a hero's proposed items, in the order the items are shown. */
export function buildForgeQueue(rows: readonly GearFlowRow[]): ForgeQueue {
  const entries: ForgeQueueEntry[] = [];
  for (const row of rows) {
    if (!row.forge) continue;
    const { from, to } = row.forge;
    entries.push({ row, from, to, rungs: forgeLadderRungs(from, to), forecast: forecastFor(row, from, to) });
  }
  const priced = entries.flatMap((entry) => (entry.forecast ? [entry.forecast] : []));
  const total =
    priced.length === 0
      ? null
      : priced.reduce(
          (sum, forecast) => ({
            rolls: sum.rolls + forecast.rolls,
            safeJumps: sum.safeJumps + forecast.safeJumps,
            gold: sum.gold + forecast.gold,
          }),
          { rolls: 0, safeJumps: 0, gold: 0 },
        );
  return { entries, total };
}
