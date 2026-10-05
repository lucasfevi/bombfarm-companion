import forgeWiki from '../data/forge-wiki.json' with { type: 'json' };

export const FORGE_GUARANTEED: number = forgeWiki.garantido;
export const FORGE_FAIL_FLOOR: number = forgeWiki.piso;
export const FORGE_MAX: number = forgeWiki.max;
export const FORGE_PITY_STEP: number = forgeWiki.pity_step;
export const FORGE_CHANCE: readonly number[] = forgeWiki.chance;
export const FORGE_CRITICAL: readonly number[] = forgeWiki.critical;
export const FORGE_FAIL_LEVEL: readonly number[] = forgeWiki.fail_level;
export const FORGE_ITEM_LEVELS: readonly number[] = forgeWiki.niveis;

/** The miss count past which every roll on the ladder is certain, so state beyond it is the same. */
export const FORGE_PITY_CAP: number = Math.ceil((1 - Math.min(...forgeWiki.chance)) / forgeWiki.pity_step - 1e-9);

const costsByLevel = new Map(
  forgeWiki.custo_por_nivel.map((row) => [
    row.nivel,
    new Map(row.por_raridade.map((byRarity) => [byRarity.raridade, byRarity])),
  ]),
);

const scrollBaseCosts = new Map(
  forgeWiki.ajudas.pergaminho.alvos.map((target, index) => [
    target,
    forgeWiki.ajudas.pergaminho.exemplos[0].custos[index],
  ]),
);

export const FORGE_STONE_PP: readonly number[] = forgeWiki.ajudas.pedra_pp;

/**
 * Per-attempt extras. `bonus` is a flat addend to every chance (the Collection's forge axis, as a
 * fraction; its unit on the wire is unmeasured). `stonePp` is one Chance Stone's points for the
 * first attempt only. `protect` ticks the Protection Scroll wherever it is offered.
 */
export type ForgeOptions = { bonus?: number; stonePp?: number; protect?: boolean };

export type ForgeRoll = {
  kind: 'roll';
  target: number;
  chance: number;
  failTo: number;
  cost: number;
  essence: number;
  /** Essence paid for the scroll on this roll; 0 when it is not ticked or not offered. */
  protection: number;
  /** Whether a stone was spent: it is refused, and kept, when the chance is already certain. */
  stoneUsed: boolean;
};

export type ForgeStep = { kind: 'done' } | ForgeRoll;

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

export function assertForgeFails(fails: number): void {
  if (!Number.isInteger(fails) || fails < 0) {
    throw new RangeError(`forge fail count must be a whole number from 0, got ${fails}`);
  }
}

/** The published chance of the roll for `target`, plus five points for each miss in a row and any flat `extra`. */
export function forgeChance(target: number, fails = 0, extra = 0): number {
  assertTarget(target);
  assertForgeFails(fails);
  return Math.min(1, FORGE_CHANCE[target - 1] + FORGE_PITY_STEP * fails + extra);
}

/** The scroll is offered only where a miss would cost levels. */
export function forgeProtectable(target: number): boolean {
  return forgeFailLevel(target) < target - 1;
}

export function forgeCritChance(target: number): number {
  assertTarget(target);
  return FORGE_CRITICAL[target - 1];
}

/** The level a piece sits on after missing the roll for `target`. */
export function forgeFailLevel(target: number): number {
  assertTarget(target);
  return FORGE_FAIL_LEVEL[target - 1];
}

function costRow(level: number, rarity: number) {
  const byRarity = costsByLevel.get(level);
  if (!byRarity) throw new RangeError(`no forge cost row for item level ${level}`);
  const row = byRarity.get(rarity);
  if (!row) throw new RangeError(`no forge cost row for rarity ${rarity}`);
  return row;
}

export function forgeRollCost(level: number, rarity: number, target: number): number {
  assertTarget(target);
  return costRow(level, rarity).custos[target - 1];
}

/** Essence spent on one roll for `target`, whether it lands or not. */
export function forgeRollEssence(level: number, rarity: number, target: number): number {
  assertTarget(target);
  return costRow(level, rarity).essencia[target - 1];
}

/** The scroll price for `target` (+12…+15), scaled from the published level-10 common price. */
export function forgeScrollCost(level: number, rarity: number, target: number): number {
  const base = scrollBaseCosts.get(target);
  if (base === undefined) throw new RangeError(`no forge scroll for target ${target}`);
  costRow(level, rarity);
  return Math.round((base * (rarity + 1) * level) / 10);
}

export function nextForgeStep(
  upgrade: number,
  target: number,
  level: number,
  rarity: number,
  fails = 0,
  options: ForgeOptions = {},
): ForgeStep {
  if (upgrade >= target) return { kind: 'done' };
  const next = upgrade + 1;
  const bonus = Math.max(0, options.bonus ?? 0);
  const stonePp = Math.max(0, options.stonePp ?? 0);
  const stoneUsed = stonePp > 0 && forgeChance(next, fails, bonus) < 1;
  const protectedRoll = options.protect === true && forgeProtectable(next);
  return {
    kind: 'roll',
    target: next,
    chance: forgeChance(next, fails, bonus + (stoneUsed ? stonePp : 0)),
    failTo: protectedRoll ? next - 1 : forgeFailLevel(next),
    cost: forgeRollCost(level, rarity, next),
    essence: forgeRollEssence(level, rarity, next),
    protection: protectedRoll ? forgeScrollCost(level, rarity, next) : 0,
    stoneUsed,
  };
}
