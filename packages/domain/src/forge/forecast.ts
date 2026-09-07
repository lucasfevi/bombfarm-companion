import { FORGE_MAX, assertForgeUpgrade, nextForgeStep, type ForgeStep } from './rules';

export type ForgeForecast = { rolls: number; safeJumps: number; gold: number };

const SETTLED_RELATIVE = 1e-14;
const MAX_SWEEPS = 200_000;

function ladderSteps(target: number, level: number, rarity: number): ForgeStep[] {
  return Array.from({ length: FORGE_MAX + 1 }, (_, upgrade) => nextForgeStep(upgrade, target, level, rarity));
}

function settled(previous: number, next: number): boolean {
  return Math.abs(next - previous) <= SETTLED_RELATIVE * Math.max(1, Math.abs(next));
}

/**
 * Expected totals by value iteration, not by walking the ladder once: a failed roll points
 * backwards (a fail at +14 lands on +8, whose expectation depends on +14's again), so no order of
 * evaluation resolves every entry from already-final neighbours. Starting from zero and sweeping
 * top-down, each pass pushes one more attempt cycle through the ladder and the totals rise
 * monotonically to the fixed point; the sweep cap is a safety net, never the stopping rule.
 */
export function forgeForecast(from: number, target: number, level: number, rarity: number): ForgeForecast {
  assertForgeUpgrade(from);
  const steps = ladderSteps(target, level, rarity);
  const rolls = new Array<number>(steps.length).fill(0);
  const safeJumps = new Array<number>(steps.length).fill(0);
  const gold = new Array<number>(steps.length).fill(0);

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let moved = false;
    for (let upgrade = steps.length - 1; upgrade >= 0; upgrade--) {
      const step = steps[upgrade];
      let nextRolls = 0;
      let nextSafeJumps = 0;
      let nextGold = 0;
      if (step.kind === 'safe') {
        nextRolls = rolls[step.target];
        nextSafeJumps = 1 + safeJumps[step.target];
        nextGold = step.cost + gold[step.target];
      } else if (step.kind === 'roll') {
        const miss = 1 - step.chance;
        nextRolls = 1 + step.chance * rolls[step.target] + miss * rolls[step.failTo];
        nextSafeJumps = step.chance * safeJumps[step.target] + miss * safeJumps[step.failTo];
        nextGold = step.cost + step.chance * gold[step.target] + miss * gold[step.failTo];
      }
      if (
        !settled(rolls[upgrade], nextRolls) ||
        !settled(safeJumps[upgrade], nextSafeJumps) ||
        !settled(gold[upgrade], nextGold)
      ) {
        moved = true;
      }
      rolls[upgrade] = nextRolls;
      safeJumps[upgrade] = nextSafeJumps;
      gold[upgrade] = nextGold;
    }
    if (!moved) break;
  }

  return { rolls: rolls[from], safeJumps: safeJumps[from], gold: gold[from] };
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

function simulateClimbGold(steps: ForgeStep[], from: number, random: () => number): number {
  let upgrade = from;
  let gold = 0;
  for (;;) {
    const step = steps[upgrade];
    if (step.kind === 'done') return gold;
    gold += step.cost;
    if (step.kind === 'safe') {
      upgrade = step.target;
    } else {
      upgrade = random() < step.chance ? step.target : step.failTo;
    }
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
): number {
  assertForgeUpgrade(from);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`percentile must be a fraction in 0…1, got ${p}`);
  if (!Number.isInteger(runs) || runs < 1) throw new RangeError(`runs must be a positive integer, got ${runs}`);
  const steps = ladderSteps(target, level, rarity);
  const random = seededRandom(seed);
  const totals = new Float64Array(runs);
  for (let run = 0; run < runs; run++) totals[run] = simulateClimbGold(steps, from, random);
  totals.sort();
  const rank = Math.max(1, Math.ceil(p * runs));
  return totals[rank - 1];
}
