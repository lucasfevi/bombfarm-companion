import type { Loadout } from '../gear/types';
import { passagemBastaoMult } from './ability-extras';
import { computeRosterAuras } from './auras';
import { effectiveUpgrade } from './pool';
import { createScoreMemo, scoreHeroLoadout } from './score';
import type { EvaluateRosterInput, HeroScore, RosterEvaluation, RosterRegime } from './types';

export const AURA_FIXED_POINT_ROUNDS = 4;
const DUTY_EPSILON = 1e-9;
const NO_EXCLUDE = '__team_plan_no_exclude__';

function loadoutForScoring(loadout: Loadout, forgeFloor: number): Loadout {
  const out: Loadout = {};
  for (const [slot, item] of Object.entries(loadout)) {
    if (!item) {
      out[slot] = null;
      continue;
    }
    out[slot] = {
      ...item,
      upgrade: effectiveUpgrade(item.upgrade, forgeFloor),
    };
  }
  return out;
}

function applyPassagem(score: HeroScore, rank: number): HeroScore {
  const mult = passagemBastaoMult(rank, score.fieldSeconds);
  return {
    ...score,
    sustained: score.sustained * mult,
    active: score.active * mult,
  };
}

function objectiveFromScores(
  scores: Record<string, HeroScore>,
  contexts: EvaluateRosterInput['contexts'],
  sumDuty: number,
  slots: number,
): { objective: number; regime: RosterRegime } {
  const optimizeIds = contexts.filter((c) => c.scope === 'optimize').map((c) => c.heroId);
  if (optimizeIds.length === 0) {
    return { objective: 0, regime: 'underSaturated' };
  }

  if (sumDuty < slots) {
    let objective = 0;
    for (const id of optimizeIds) {
      objective += scores[id]?.sustained ?? 0;
    }
    return { objective, regime: 'underSaturated' };
  }

  let weightedActive = 0;
  for (const id of optimizeIds) {
    const score = scores[id];
    if (!score) continue;
    weightedActive += score.duty * score.active;
  }
  const objective = sumDuty > 0 ? slots * (weightedActive / sumDuty) : 0;
  return { objective, regime: 'saturated' };
}

export function evaluateRoster(input: EvaluateRosterInput): RosterEvaluation {
  const slots = Math.max(1, Math.round(input.slots));
  const memo = input.scoreMemo ?? createScoreMemo();
  const optimizeContexts = input.contexts.filter((ctx) => ctx.scope === 'optimize');
  // Loop-invariant: the forge-floored loadout depends only on the input loadout and the forge
  // floor, neither of which the fixed-point rounds touch. Building it inside the round loop
  // rebuilt every hero's loadout four times per evaluation for nothing.
  const scoringLoadouts: Record<string, Loadout> = {};
  for (const ctx of optimizeContexts) {
    scoringLoadouts[ctx.heroId] = loadoutForScoring(
      input.loadoutsByHeroId[ctx.heroId] ?? {},
      input.forgeFloor,
    );
  }
  const duties: Record<string, number> = {};
  let perHero: Record<string, HeroScore> = {};
  let sumDuty = 0;

  for (let round = 0; round < AURA_FIXED_POINT_ROUNDS; round++) {
    const prevSumDuty = sumDuty;
    sumDuty = 0;
    const roundScores: Record<string, HeroScore> = {};
    const nextDuties: Record<string, number> = {};

    for (const ctx of optimizeContexts) {
      const auras = computeRosterAuras(input.contexts, duties, ctx.heroId);
      const loadout = scoringLoadouts[ctx.heroId];
      const pts = input.ptsByHeroId[ctx.heroId] ?? ctx.pts;
      const raw = scoreHeroLoadout(ctx, loadout, pts, auras, input.farm, memo);
      const scored = applyPassagem(raw, ctx.abilities.passagem_bastao ?? 0);
      roundScores[ctx.heroId] = scored;
      nextDuties[ctx.heroId] = raw.duty;
      sumDuty += raw.duty;
    }

    Object.assign(duties, nextDuties);
    perHero = roundScores;

    if (round > 0 && Math.abs(sumDuty - prevSumDuty) < DUTY_EPSILON) {
      break;
    }
  }

  const { objective, regime } = objectiveFromScores(perHero, input.contexts, sumDuty, slots);
  const auras = computeRosterAuras(input.contexts, duties, NO_EXCLUDE);

  return {
    objective,
    regime,
    sumDuty,
    slots,
    perHero,
    auras,
  };
}
