import {
  FORGE_MAX,
  FORGE_PITY_CAP,
  assertForgeFails,
  assertForgeUpgrade,
  nextForgeStep,
  type ForgeOptions,
  type ForgeRoll,
} from './rules';

export type ForgeForecast = { rolls: number; gold: number; essence: number };

function rollAt(
  upgrade: number,
  fails: number,
  target: number,
  level: number,
  rarity: number,
  options: ForgeOptions,
): ForgeRoll {
  const step = nextForgeStep(upgrade, target, level, rarity, fails, options);
  if (step.kind !== 'roll') throw new RangeError('no roll above the target');
  return step;
}

function solve(matrix: number[][], constants: number[]): number[] {
  const size = constants.length;
  const rows = matrix.map((row, index) => [...row, constants[index]]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = rows[row][column] / rows[column][column];
      if (factor === 0) continue;
      for (let k = column; k <= size; k++) rows[row][k] -= factor * rows[column][k];
    }
  }
  return rows.map((row, index) => row[size] / row[index]);
}

/**
 * Expected total of `price` (per roll) to climb from `upgrade` carrying `fails` misses in a row.
 * A hit always resets the miss count, so every state a climb returns to after a hit is a
 * (level, 0) one: each (level, misses) value is written as an affine function of those, from the
 * all-certain miss cap downward, and the small linear system left over is solved exactly. A value
 * iteration would need thousands of passes where a +15 climb takes thousands of cycles.
 */
function expectedTotal(
  from: number,
  fails: number,
  target: number,
  price: (roll: ForgeRoll) => number,
  level: number,
  rarity: number,
  options: ForgeOptions,
): number {
  const { stonePp, ...standing } = options;
  const width = target + 1;
  const zero = () => new Array<number>(width).fill(0);

  let above: number[][] = Array.from({ length: target }, () => zero());
  const byFails: number[][][] = [];
  for (let missed = FORGE_PITY_CAP; missed >= 0; missed--) {
    const here: number[][] = [];
    for (let upgrade = 0; upgrade < target; upgrade++) {
      const roll = rollAt(upgrade, missed, target, level, rarity, standing);
      const value = zero();
      value[target] = price(roll);
      const failure = above[roll.failTo];
      for (let k = 0; k < width; k++) value[k] += (1 - roll.chance) * failure[k];
      if (roll.target < target) value[roll.target] += roll.chance;
      here.push(value);
    }
    byFails[missed] = here;
    above = here;
  }

  const matrix = byFails[0].map((value, upgrade) =>
    Array.from({ length: target }, (_, k) => (upgrade === k ? 1 : 0) - value[k]),
  );
  const solution = solve(
    matrix,
    byFails[0].map((value) => value[target]),
  );
  const valueAt = (upgrade: number, missed: number) => {
    const row = byFails[Math.min(missed, FORGE_PITY_CAP)][upgrade];
    return row[target] + solution.reduce((sum, value, k) => sum + row[k] * value, 0);
  };
  if (!(stonePp !== undefined && stonePp > 0)) return valueAt(from, fails);
  const first = rollAt(from, fails, target, level, rarity, options);
  const onHit = first.target < target ? solution[first.target] : 0;
  return price(first) + first.chance * onHit + (1 - first.chance) * valueAt(first.failTo, fails + 1);
}

export function forgeForecast(
  from: number,
  target: number,
  level: number,
  rarity: number,
  fails = 0,
  options: ForgeOptions = {},
): ForgeForecast {
  assertForgeUpgrade(from);
  assertForgeFails(fails);
  if (from >= target) return { rolls: 0, gold: 0, essence: 0 };
  if (target > FORGE_MAX) throw new RangeError(`forge target must be +1…+${FORGE_MAX}, got ${target}`);
  return {
    rolls: expectedTotal(from, fails, target, () => 1, level, rarity, options),
    gold: expectedTotal(from, fails, target, (roll) => roll.cost, level, rarity, options),
    essence: expectedTotal(from, fails, target, (roll) => roll.essence + roll.protection, level, rarity, options),
  };
}

/** mulberry32 — a 32-bit seeded generator, kept in-module so a forecast needs no dependency. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function rollTable(target: number, level: number, rarity: number, options: ForgeOptions): ForgeRoll[][] {
  return Array.from({ length: target }, (_, upgrade) =>
    Array.from({ length: FORGE_PITY_CAP + 1 }, (_, missed) => rollAt(upgrade, missed, target, level, rarity, options)),
  );
}

function simulateClimbGold(
  fails: number,
  target: number,
  table: ForgeRoll[][],
  firstRoll: ForgeRoll,
  random: () => number,
): number {
  let roll = firstRoll;
  let missed = fails;
  let gold = 0;
  for (;;) {
    gold += roll.cost;
    let upgrade: number;
    if (random() < roll.chance) {
      upgrade = roll.target;
      missed = 0;
    } else {
      upgrade = roll.failTo;
      missed += 1;
    }
    if (upgrade >= target) return gold;
    roll = table[upgrade][Math.min(missed, FORGE_PITY_CAP)];
  }
}

export function forgeGoldPercentile(
  from: number,
  target: number,
  level: number,
  rarity: number,
  p: number,
  seed: number,
  runs = 10_000,
  fails = 0,
  options: ForgeOptions = {},
): number {
  assertForgeUpgrade(from);
  assertForgeFails(fails);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`percentile must be a fraction in 0…1, got ${p}`);
  if (!Number.isInteger(runs) || runs < 1) throw new RangeError(`runs must be a positive integer, got ${runs}`);
  if (from >= target) return 0;
  const random = seededRandom(seed);
  const totals = new Float64Array(runs);
  const { stonePp, ...standing } = options;
  const table = rollTable(target, level, rarity, standing);
  const firstRoll = rollAt(from, fails, target, level, rarity, { ...standing, stonePp });
  for (let run = 0; run < runs; run++) totals[run] = simulateClimbGold(fails, target, table, firstRoll, random);
  totals.sort();
  const rank = Math.max(1, Math.ceil(p * runs));
  return totals[rank - 1];
}
