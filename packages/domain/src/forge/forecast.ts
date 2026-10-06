import {
  FORGE_MAX,
  FORGE_STONE_RARITIES,
  FORGE_PITY_CAP,
  assertForgeFails,
  assertForgeUpgrade,
  nextForgeStep,
  type ForgeOptions,
  type ForgeRoll,
} from './rules';

export type ForgeForecast = {
  rolls: number;
  gold: number;
  essence: number;
  /** Expected Chance Stones spent per rarity, indexed 0â€¦5; only attempts the game accepts a stone on count. */
  stones: readonly number[];
};

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

function solve(matrix: number[][], constants: number[][]): number[][] {
  const size = matrix.length;
  const width = constants[0]?.length ?? 0;
  const rows = matrix.map((row, index) => [...row, ...constants[index]]);
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
      for (let k = column; k < size + width; k++) rows[row][k] -= factor * rows[column][k];
    }
  }
  return rows.map((row, index) => row.slice(size).map((value) => value / row[index]));
}

const PRICED = 3;
const COMPONENTS = PRICED + FORGE_STONE_RARITIES;

/** What one roll adds to each running total: rolls, gold, essence with scroll, then one count per stone rarity. */
function componentsOf(roll: ForgeRoll): number[] {
  const parts = new Array<number>(COMPONENTS).fill(0);
  parts[0] = 1;
  parts[1] = roll.cost;
  parts[2] = roll.essence + roll.protection;
  if (roll.stone !== null) parts[PRICED + roll.stone] = 1;
  return parts;
}

type Affine = { coefficients: number[]; constants: number[] };

/**
 * Expected totals of every component (see {@link componentsOf}) to climb from `upgrade` carrying
 * `fails` misses in a row. A hit always resets the miss count, so every state a climb returns to
 * after a hit is a (level, 0) one: each (level, misses) value is written as an affine function of
 * those, from the all-certain miss cap downward, and the small linear system left over is solved
 * exactly. A value iteration would need thousands of passes where a +15 climb takes thousands of
 * cycles. Stones named per target keep the chain stationary; only `stonePp`, for the first attempt
 * alone, is handled outside it.
 */
function expectedTotals(
  from: number,
  fails: number,
  target: number,
  level: number,
  rarity: number,
  options: ForgeOptions,
): number[] {
  const { stonePp, ...standing } = options;
  const zeros = () => new Array<number>(target).fill(0);

  let above: Affine[] = Array.from({ length: target }, () => ({
    coefficients: zeros(),
    constants: new Array<number>(COMPONENTS).fill(0),
  }));
  const byFails: Affine[][] = [];
  for (let missed = FORGE_PITY_CAP; missed >= 0; missed--) {
    const here: Affine[] = [];
    for (let upgrade = 0; upgrade < target; upgrade++) {
      const roll = rollAt(upgrade, missed, target, level, rarity, standing);
      const failure = above[roll.failTo];
      const miss = 1 - roll.chance;
      const coefficients = failure.coefficients.map((value) => miss * value);
      const constants = componentsOf(roll).map((value, c) => value + miss * failure.constants[c]);
      if (roll.target < target) coefficients[roll.target] += roll.chance;
      here.push({ coefficients, constants });
    }
    byFails[missed] = here;
    above = here;
  }

  const matrix = byFails[0].map((value, upgrade) =>
    value.coefficients.map((coefficient, k) => (upgrade === k ? 1 : 0) - coefficient),
  );
  const solution = solve(
    matrix,
    byFails[0].map((value) => value.constants),
  );
  const valueAt = (upgrade: number, missed: number): number[] => {
    const row = byFails[Math.min(missed, FORGE_PITY_CAP)][upgrade];
    return row.constants.map((constant, c) =>
      row.coefficients.reduce((sum, coefficient, k) => sum + coefficient * solution[k][c], constant),
    );
  };
  if (!(stonePp !== undefined && stonePp > 0)) return valueAt(from, fails);
  const first = rollAt(from, fails, target, level, rarity, options);
  const onHit = first.target < target ? solution[first.target] : new Array<number>(COMPONENTS).fill(0);
  const onMiss = valueAt(first.failTo, fails + 1);
  return componentsOf(first).map((value, c) => value + first.chance * onHit[c] + (1 - first.chance) * onMiss[c]);
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
  if (from >= target) return { rolls: 0, gold: 0, essence: 0, stones: new Array<number>(FORGE_STONE_RARITIES).fill(0) };
  if (target > FORGE_MAX) throw new RangeError(`forge target must be +1â€¦+${FORGE_MAX}, got ${target}`);
  const totals = expectedTotals(from, fails, target, level, rarity, options);
  return { rolls: totals[0], gold: totals[1], essence: totals[2], stones: totals.slice(PRICED) };
}

const BUCKETS = 8_000;
const MAX_DOUBLINGS = 8;

type Spend = 'gold' | 'essence';
type Transition = { gold: number; essence: number; chance: number; hit: number; miss: number };
type Chain = { states: Transition[]; first: Transition; expected: ForgeForecast };

function buildChain(
  from: number,
  target: number,
  level: number,
  rarity: number,
  fails: number,
  options: ForgeOptions,
): Chain {
  const { stonePp, ...standing } = options;
  const width = FORGE_PITY_CAP + 1;
  const indexOf = (upgrade: number, missed: number) => upgrade * width + Math.min(missed, FORGE_PITY_CAP);
  const transitionOf = (roll: ForgeRoll, missed: number): Transition => ({
    gold: roll.cost,
    essence: roll.essence + roll.protection,
    chance: roll.chance,
    hit: roll.target < target ? indexOf(roll.target, 0) : -1,
    miss: indexOf(roll.failTo, missed + 1),
  });
  const states: Transition[] = [];
  for (let upgrade = 0; upgrade < target; upgrade++) {
    for (let missed = 0; missed <= FORGE_PITY_CAP; missed++) {
      states.push(transitionOf(rollAt(upgrade, missed, target, level, rarity, standing), missed));
    }
  }
  const first = transitionOf(rollAt(from, fails, target, level, rarity, { ...standing, stonePp }), fails);
  return { states, first, expected: forgeForecast(from, target, level, rarity, fails, options) };
}

/**
 * The `p` quantile (nearest rank) of what a climb spends, read off the exact distribution: the
 * probability mass of every (level, misses) state is pushed forward roll by roll, binned by the
 * amount spent. A roll's price is fixed per rung, so the total only ever grows and one sweep
 * through the bins in order visits each state once. A price that falls between two bins splits its
 * mass across them and carries the exact total alongside, so a bin reports the mean of what landed
 * in it rather than its edge.
 */
function spendQuantile(chain: Chain, spend: Spend, p: number): number {
  const { states, first } = chain;
  let cheapestRisky = Number.POSITIVE_INFINITY;
  let dearest = 0;
  for (const transition of [...states, first]) {
    if (transition.chance < 1 && transition[spend] > 0) cheapestRisky = Math.min(cheapestRisky, transition[spend]);
    dearest = Math.max(dearest, transition[spend]);
  }

  let ceiling = 4 * chain.expected[spend];
  if (!(ceiling > 0)) return 0;
  for (let attempt = 0; ; attempt++, ceiling *= 2) {
    const binSize = Math.min(ceiling / BUCKETS, cheapestRisky);
    const bins = Math.ceil(ceiling / binSize);
    const reach = Math.ceil(dearest / binSize) + 2;
    const mass = new Float64Array(reach * states.length);
    const spentTotal = new Float64Array(reach * states.length);
    const doneMass = new Float64Array(bins + 1);
    const doneSpent = new Float64Array(bins + 1);

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
        doneSpent[landing] += spent * weight;
        return;
      }
      const slot = (landing % reach) * states.length + destination;
      mass[slot] += amount * weight;
      spentTotal[slot] += spent * weight;
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
      const price = transition[spend] / binSize;
      const lower = Math.floor(price);
      const upper = price - lower;
      const moved = spent + amount * transition[spend];
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
        const spent = spentTotal[base + state];
        mass[base + state] = 0;
        spentTotal[base + state] = 0;
        const transition = states[state];
        send(bin, transition, amount, spent, transition.chance, transition.hit);
        send(bin, transition, amount, spent, 1 - transition.chance, transition.miss);
      }
      absorbed += doneMass[bin];
      if (absorbed > 0 && absorbed >= p - 1e-12) return doneSpent[bin] / doneMass[bin];
    }
    if (attempt === MAX_DOUBLINGS) return ceiling;
  }
}

function checkedChain(
  from: number,
  target: number,
  level: number,
  rarity: number,
  p: number,
  fails: number,
  options: ForgeOptions,
): Chain | null {
  assertForgeUpgrade(from);
  assertForgeFails(fails);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`percentile must be a fraction in 0…1, got ${p}`);
  if (from >= target) return null;
  if (target > FORGE_MAX) throw new RangeError(`forge target must be +1…+${FORGE_MAX}, got ${target}`);
  return buildChain(from, target, level, rarity, fails, options);
}

export function forgeGoldQuantile(
  from: number,
  target: number,
  level: number,
  rarity: number,
  p: number,
  fails = 0,
  options: ForgeOptions = {},
): number {
  const chain = checkedChain(from, target, level, rarity, p, fails, options);
  return chain === null ? 0 : spendQuantile(chain, 'gold', p);
}

/** The same quantile of the essence a climb spends — each roll's essence plus the scroll's when it is on. */
export function forgeEssenceQuantile(
  from: number,
  target: number,
  level: number,
  rarity: number,
  p: number,
  fails = 0,
  options: ForgeOptions = {},
): number {
  const chain = checkedChain(from, target, level, rarity, p, fails, options);
  return chain === null ? 0 : spendQuantile(chain, 'essence', p);
}

/** Both quantiles of one climb, sharing the transition table and the expected totals that size the bins. */
export function forgeSpendQuantiles(
  from: number,
  target: number,
  level: number,
  rarity: number,
  p: number,
  fails = 0,
  options: ForgeOptions = {},
): { gold: number; essence: number } {
  const chain = checkedChain(from, target, level, rarity, p, fails, options);
  if (chain === null) return { gold: 0, essence: 0 };
  return { gold: spendQuantile(chain, 'gold', p), essence: spendQuantile(chain, 'essence', p) };
}
