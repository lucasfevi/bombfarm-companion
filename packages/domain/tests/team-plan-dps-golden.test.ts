/**
 * The damage objective's plan, pinned to values captured BEFORE the farm objective existed.
 *
 * Every other guard on damage mode compares two runs of the same code — an omitted objective
 * against an explicit `'dps'` — which cannot see a drift that moves both. These numbers were
 * taken from commit bf24256b, the parent of the farm-objective change, by running `runTeamPlan`
 * at its own default evaluation budget on the captures named below and recording the whole plan.
 * The full 16-way comparison (eight captures x forge floors 0 and 10) came out byte-identical;
 * three are pinned here, chosen for size and for the two different seeds they exercise.
 *
 * A failure here is a change in what damage mode recommends. That may be intended — but it is
 * never a side effect, and re-recording these is a deliberate act with its own reasoning.
 *
 * RE-RECORDED ONCE, when the damage objective moved onto the same aura form as the gold objective
 * and the Farm board (the expected value of the CAPPED sum over independently present carriers,
 * `computeTeamBuffsOverRotation`, in place of clamping the duty-weighted sum). The 7-hero
 * capture carries one carrier per aura and did not move. The two 13-hero captures each field several
 * part-time carriers of one capped aura, which the old form held at the cap the whole time:
 * crit-points moved −0.15% on both DPS figures with the plan itself byte-identical; soulbound,
 * whose three Fôlego carriers had summed to 60 against a cap of 20, moved −3.7% and dropped two
 * point resets while keeping every gear move. Nothing else was touched.
 *
 * NOT regime-bound: the claim is "this code still plans what it planned", an identity between two
 * revisions of the same arithmetic, not a statement about what the game rewards.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import type { Loadout } from '@bombfarm/domain/gear/types';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

/** Order-independent: hero ids and slot names sorted, so the digest pins the CONTENT of the
 *  proposal rather than the order two revisions happened to build the record in. */
function loadoutDigest(loadouts: Record<string, Loadout>): string {
  const body = Object.keys(loadouts)
    .sort()
    .map((heroId) => {
      const loadout = loadouts[heroId];
      const slots = Object.keys(loadout)
        .sort()
        .map((slot) => {
          const item = loadout[slot];
          const stamp = item
            ? [item.defId, item.rarityIdx, item.level, item.upgrade].join('|')
            : 'null';
          return `${slot}:${stamp}`;
        });
      return `${heroId}{${slots.join(',')}}`;
    })
    .join(';');
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

const GOLDENS = [
  {
    file: 'save-20260819-11882-7heroes.json',
    forgeFloor: 10,
    currentDps: 4159.354708300664,
    planDps: 4935.861831079204,
    moves: 18,
    forges: 40,
    pointResets: 5,
    seedUsed: 'current',
    loadoutDigest: 'e53242ce5e9871bf',
  },
  {
    file: 'save-20260823-13heroes-crit-points.json',
    forgeFloor: 10,
    currentDps: 64571.66678255393,
    planDps: 100463.73075727368,
    moves: 110,
    forges: 17,
    pointResets: 11,
    seedUsed: 'current',
    loadoutDigest: '91b17ab317a62b28',
  },
  {
    file: 'save-20260831-13heroes-soulbound.json',
    forgeFloor: 10,
    currentDps: 7963.068783581081,
    planDps: 8690.407658610899,
    moves: 64,
    forges: 69,
    pointResets: 8,
    seedUsed: 'greedyHeroDps',
    loadoutDigest: '86db9ea653aa59e3',
  },
];

describe('the damage objective still plans what it planned before the farm objective landed', () => {
  it.each(GOLDENS)('$file', (golden) => {
    const fixture = loadTeamPlanFarmFixture(golden.file, { forgeFloor: golden.forgeFloor });
    const result = runTeamPlan(fixture.teamPlanInput);
    if (result.blocked) throw new Error(`fixture blocked: ${result.heroNames.join(', ')}`);
    const plan = result.plan;

    expect(plan.currentDps).toBe(golden.currentDps);
    expect(plan.planDps).toBe(golden.planDps);
    expect(plan.moveList).toHaveLength(golden.moves);
    expect(plan.forgeList).toHaveLength(golden.forges);
    expect(plan.pointResets).toHaveLength(golden.pointResets);
    expect(plan.run.seedUsed).toBe(golden.seedUsed);
    expect(loadoutDigest(plan.proposedLoadouts)).toBe(golden.loadoutDigest);
  });
});
