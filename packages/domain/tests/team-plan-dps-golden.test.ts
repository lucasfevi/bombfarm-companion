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
 * RE-RECORDED AGAIN 2026-09-12, on top of the aura-form re-record above, when the advisor
 * adopted the farm board's measured bomb cycle (apps/web/docs/adr/016). Every DPS the scorer reads moved — the serial fuse-plus-0.15 s cycle
 * ran ~1.4x faster than the measured one at these rosters' CDR — and with Speed now a real
 * throughput stat and CDR no longer paying past the walk, the plans themselves changed shape
 * (move counts, digests). Same method as the original recording: `runTeamPlan` at its default
 * budget on the same three captures, forge floor 10.
 *
 * RE-RECORDED A THIRD TIME 2026-09-12, for a game-data change rather than a code one: the wiki
 * published Misericórdia at 0.75% of HP per level (was 1.25%), and the `executePct` kind prices
 * that threshold into every carrier's DPS. currentDps moved −4.2% (7 heroes), −5.9% (crit-points)
 * and −1.0% (soulbound); the 7-hero plan is byte-identical, the two 13-hero plans each dropped a
 * few moves (122 → 118, 56 → 54) and soulbound gained one point reset. Same method again.
 *
 * RE-RECORDED A FOURTH TIME 2026-09-13, for the abilities pass — three abilities the objective
 * had never priced. Passagem de Bastão became the field-wide pulse the wiki's scope column says
 * it is (every hero on the field lit for 120 s of each carrier's rotation cycle, priced like the
 * auras) in place of a multiplier on the carrier's own hits; the 7-hero capture's one rank-6
 * carrier lifts both DPS figures +2.2% with the plan byte-identical, and crit-points' rank-20
 * carrier lifts today's DPS +5.2% and the plan's +4.4%, with six fewer moves and a new loadout
 * digest — the carrier's stint now moves every hero's score, not just its own. Soulbound carries
 * no Baton Pass and no Brecha; what moved it +5.5% / +5.2% is Matilha — Jon's rank 20 and Nyx's
 * rank 8, each priced at the allies its rotation keeps beside it — and the plan changed shape
 * with it: 37 moves for 54, one fewer forge, two fewer point resets, and the seed that won went
 * from the greedy per-hero seed back to the roster as it stands. Same method again.
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
    currentDps: 2790.210159891838,
    planDps: 3316.9354467552575,
    moves: 20,
    forges: 40,
    pointResets: 5,
    seedUsed: 'current',
    loadoutDigest: 'afd4e3c50dcfaab9',
  },
  {
    file: 'save-20260823-13heroes-crit-points.json',
    forgeFloor: 10,
    currentDps: 45459.16519724657,
    planDps: 70558.72634133865,
    moves: 112,
    forges: 18,
    pointResets: 11,
    seedUsed: 'current',
    loadoutDigest: 'df9ebf69f5367bc8',
  },
  {
    file: 'save-20260831-13heroes-soulbound.json',
    forgeFloor: 10,
    currentDps: 5798.730447486583,
    planDps: 6312.744998349591,
    moves: 37,
    forges: 68,
    pointResets: 8,
    seedUsed: 'current',
    loadoutDigest: '8b0a3d02618aedb7',
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
