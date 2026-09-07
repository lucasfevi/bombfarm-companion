import forgeWiki from '../data/forge-wiki.json' with { type: 'json' };

/** Every number in this module is what the game's wiki forge page publishes. */
export const FORGE_SAFE: number = forgeWiki.safe;
export const FORGE_MAX: number = forgeWiki.max;
export const FORGE_CHANCE: readonly number[] = forgeWiki.chance;
export const FORGE_CRITICAL: readonly number[] = forgeWiki.critical;
export const FORGE_ITEM_LEVELS: readonly number[] = forgeWiki.niveis;

const costsByLevel = new Map(
  forgeWiki.custo_por_nivel.map((row) => [
    row.nivel,
    new Map(row.por_raridade.map((byRarity) => [byRarity.raridade, byRarity.custos])),
  ]),
);

export type ForgeStep =
  | { kind: 'done' }
  | { kind: 'safe'; target: number; cost: number }
  | { kind: 'roll'; target: number; chance: number; failTo: number; cost: number };

function assertTarget(target: number): void {
  if (!Number.isInteger(target) || target < 1 || target > FORGE_MAX) {
    throw new RangeError(`forge target must be +1…+${FORGE_MAX}, got ${target}`);
  }
}

export function assertForgeUpgrade(upgrade: number): void {
  if (!Number.isInteger(upgrade) || upgrade < 0 || upgrade > FORGE_MAX) {
    throw new RangeError(`forge upgrade must be +0…+${FORGE_MAX}, got ${upgrade}`);
  }
}

export function forgeChance(target: number): number {
  assertTarget(target);
  return FORGE_CHANCE[target - 1];
}

export function forgeCritChance(target: number): number {
  assertTarget(target);
  return FORGE_CRITICAL[target - 1];
}

export function forgeFailFloor(target: number): number {
  assertTarget(target);
  return target === FORGE_MAX ? 0 : FORGE_SAFE;
}

export function forgeRollCost(level: number, rarity: number, target: number): number {
  assertTarget(target);
  const byRarity = costsByLevel.get(level);
  if (!byRarity) throw new RangeError(`no forge cost row for item level ${level}`);
  const costs = byRarity.get(rarity);
  if (!costs) throw new RangeError(`no forge cost row for rarity ${rarity}`);
  return costs[target - 1];
}

export function forgeSafeJumpCost(level: number, rarity: number): number {
  let total = 0;
  for (let target = 1; target <= FORGE_SAFE; target++) total += forgeRollCost(level, rarity, target);
  return total;
}

export function nextForgeStep(upgrade: number, target: number, level: number, rarity: number): ForgeStep {
  if (upgrade >= target) return { kind: 'done' };
  if (upgrade < FORGE_SAFE && target >= FORGE_SAFE) {
    return { kind: 'safe', target: FORGE_SAFE, cost: forgeSafeJumpCost(level, rarity) };
  }
  const next = upgrade + 1;
  return {
    kind: 'roll',
    target: next,
    chance: forgeChance(next),
    failTo: forgeFailFloor(next),
    cost: forgeRollCost(level, rarity, next),
  };
}
