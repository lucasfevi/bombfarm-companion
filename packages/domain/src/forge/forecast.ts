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

const GOLD_BUCKETS = 8_000;
const MAX_DOUBLINGS = 8;

type Transition = { cost: number; chance: number; hit: number; miss: number };

/**
 * The `p` quantile (nearest rank) of the gold a climb costs, read off the exact distribution: the
 * probability mass of every (level, misses) state is pushed forward roll by roll, binned by gold
 * spent. A roll's price is fixed per rung, so gold only ever grows and one sweep through the bins
 * in order visits each state once. A price that falls between two bins splits its mass across them
 * and carries the exact gold alongside, so a bin reports the mean of what landed in it rather than
 * its edge.
 */
export function forgeGoldQuantile(
  from: number,
  target: number,
  level: number,
  rarity: number,
  p: number,
  fails = 0,
  options: ForgeOptions = {},
): number {
  assertForgeUpgrade(from);
  assertForgeFails(fails);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`percentile must be a fraction in 0…1, got ${p}`);
  if (from >= target) return 0;
  if (target > FORGE_MAX) throw new RangeError(`forge target must be +1…+${FORGE_MAX}, got ${target}`);
  const { stonePp, ...standing } = options;
  const width = FORGE_PITY_CAP + 1;
  const indexOf = (upgrade: number, missed: number) => upgrade * width + Math.min(missed, FORGE_PITY_CAP);
  const transitionOf = (roll: ForgeRoll, missed: number): Transition => ({
    cost: roll.cost,
    chance: roll.chance,
    hit: roll.target < target ? indexOf(roll.target, 0) : -1,
    miss: indexOf(roll.failTo, missed + 1),
  });
  const states: Transition[] = [];
  let cheapestRisky = Number.POSITIVE_INFINITY;
  let dearest = 0;
  for (let upgrade = 0; upgrade < target; upgrade++) {
    for (let missed = 0; missed <= FORGE_PITY_CAP; missed++) {
      const transition = transitionOf(rollAt(upgrade, missed, target, level, rarity, standing), missed);
      states.push(transition);
      if (transition.chance < 1) cheapestRisky = Math.min(cheapestRisky, transition.cost);
      dearest = Math.max(dearest, transition.cost);
    }
  }
  const first = transitionOf(rollAt(from, fails, target, level, rarity, { ...standing, stonePp }), fails);
  dearest = Math.max(dearest, first.cost);
  if (first.chance < 1) cheapestRisky = Math.min(cheapestRisky, first.cost);

  let ceiling = 4 * forgeForecast(from, target, level, rarity, fails, options).gold;
  for (let attempt = 0; ; attempt++, ceiling *= 2) {
    const binGold = Math.min(ceiling / GOLD_BUCKETS, cheapestRisky);
    const bins = Math.ceil(ceiling / binGold);
    const reach = Math.ceil(dearest / binGold) + 2;
    const mass = new Float64Array(reach * states.length);
    const gold = new Float64Array(reach * states.length);
    const doneMass = new Float64Array(bins + 1);
    const doneGold = new Float64Array(bins + 1);

    const deposit = (
      landing: number,
      destination: number,
      amount: number,
      spent: number,
      weight: number,
    ) => {
      if (weight === 0) return;
      if (destination < 0) {
        if (landing > bins) return;
        doneMass[landing] += amount * weight;
        doneGold[landing] += spent * weight;
        return;
      }
      const slot = (landing % reach) * states.length + destination;
      mass[slot] += amount * weight;
      gold[slot] += spent * weight;
    };
    const send = (
      bin: number,
      transition: Transition,
      amount: number,
      spent: number,
      probability: number,
      destination: number,
    ) => {
      if (probability === 0) return;
      const price = transition.cost / binGold;
      const lower = Math.floor(price);
      const upper = price - lower;
      const moved = spent + amount * transition.cost;
      deposit(bin + lower, destination, amount, moved, probability * (1 - upper));
      deposit(bin + lower + 1, destination, amount, moved, probability * upper);
    };

    send(0, first, 1, 0, first.chance, first.hit);
    send(0, first, 1, 0, 1 - first.chance, first.miss);
    let absorbed = 0;
    for (let bin = 0; bin <= bins; bin++) {
      const base = (bin % reach) * states.length;
      for (let state = 0; state < states.length; state++) {
        const amount = mass[base + state];
        if (amount === 0) continue;
        const spent = gold[base + state];
        mass[base + state] = 0;
        gold[base + state] = 0;
        const transition = states[state];
        send(bin, transition, amount, spent, transition.chance, transition.hit);
        send(bin, transition, amount, spent, 1 - transition.chance, transition.miss);
      }
      absorbed += doneMass[bin];
      if (absorbed > 0 && absorbed >= p - 1e-12) return doneGold[bin] / doneMass[bin];
    }
    if (attempt === MAX_DOUBLINGS) return ceiling;
  }
}
