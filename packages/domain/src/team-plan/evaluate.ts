import type { Loadout } from '../gear/types';
import {
  alliesOverRotation,
  PASSAGEM_BASTAO_CAPPED_PULSE,
  passagemBastaoFieldPulse,
  passagemBastaoPresence,
  type PassagemBastaoCarrier,
  type PassagemBastaoFieldPulse,
} from '../model';
import { pulseHeldAtCap, type AurasAtCap } from '../team-buffs';
import { computeRosterAuras, isSquadScope } from './auras';
import { evaluateFarmObjective, screenFarmObjective } from './farm-objective';
import { effectiveUpgrade } from './pool';
import { createScoreMemo, scoreHeroLoadout } from './score';
import type { TeamBuffId } from '../team-buffs';
import type {
  EvaluateRosterInput,
  HeroPlanContext,
  HeroScore,
  RosterEvaluation,
  RosterRegime,
  ScoreMemo,
} from './types';

export const AURA_FIXED_POINT_ROUNDS = 4;
const DUTY_EPSILON = 1e-9;

export function loadoutForScoring(loadout: Loadout, forgeFloor: number): Loadout {
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

/**
 * The loadouts a roster evaluation actually scores: optimize-scope heroes only, each at the run's
 * forge floor. Shared with the farm point pass, which must search the very build the evaluation
 * that accepts or rejects it will price.
 */
export function scoringLoadoutsFor(
  contexts: readonly HeroPlanContext[],
  loadoutsByHeroId: Readonly<Record<string, Loadout>>,
  forgeFloor: number,
): Record<string, Loadout> {
  const out: Record<string, Loadout> = {};
  for (const ctx of contexts) {
    if (ctx.scope !== 'optimize') continue;
    out[ctx.heroId] = loadoutForScoring(loadoutsByHeroId[ctx.heroId] ?? {}, forgeFloor);
  }
  return out;
}

type Stint = { fieldSeconds: number; duty: number };

/**
 * Matilha's allies for every hero on the rotation, from the duties the auras are weighted by:
 * each other squad hero beside the carrier for its own duty, capped by the field's other slots
 * (`alliesOverRotation`). Like the aura total it reads the PREVIOUS round's duties, since a
 * hero's damage is priced before its own stint this round is known.
 */
function alliesByHeroId(
  contexts: readonly HeroPlanContext[],
  dutyByHeroId: Readonly<Record<string, number>>,
  slots: number,
): Record<string, number> {
  const presence = contexts.map((ctx) =>
    isSquadScope(ctx.scope) ? (dutyByHeroId[ctx.heroId] ?? 0) : 0,
  );
  const out: Record<string, number> = {};
  contexts.forEach((ctx, index) => {
    out[ctx.heroId] = alliesOverRotation(presence, index, slots);
  });
  return out;
}

/**
 * Passagem de Bastão over the rotation, priced as the auras are (`computeRosterAuras`): every
 * fielded carrier's pulse lights the whole field for its own share of wall clock, at the stint
 * length and duty its build sustains this round. A hero the player leaves alone still fields, so
 * its pulse counts; a donated one is out. Like the aura total it does not depend on which hero
 * is asking, so callers compute it once per round. Held at the cap instead, whatever the carriers
 * sustain, when `aurasAtCap` names the ability (`TeamPlanInput.aurasAtCap`).
 */
function computeFieldPulse(
  contexts: readonly HeroPlanContext[],
  stints: Readonly<Record<string, Stint>>,
  aurasAtCap: AurasAtCap | undefined,
): PassagemBastaoFieldPulse {
  if (pulseHeldAtCap(aurasAtCap)) return PASSAGEM_BASTAO_CAPPED_PULSE;
  const carriers: PassagemBastaoCarrier[] = [];
  for (const ctx of contexts) {
    const rank = ctx.abilities.passagem_bastao ?? 0;
    const stint = stints[ctx.heroId];
    if (!isSquadScope(ctx.scope) || !(rank > 0) || !stint) continue;
    carriers.push({ rank, presence: passagemBastaoPresence(stint.fieldSeconds, stint.duty) });
  }
  return passagemBastaoFieldPulse(carriers);
}

/** A DPS figure is linear in damage, so the field pulse reaches it as its expectation. */
function applyFieldPulse(score: HeroScore, entryPulseMult: number): HeroScore {
  if (entryPulseMult === 1) return score;
  return {
    ...score,
    sustained: score.sustained * entryPulseMult,
    active: score.active * entryPulseMult,
  };
}

/**
 * `ignoreFieldCrowding` keeps the roster on the unsaturated sum however much duty it asks for.
 *
 * The saturated branch below divides by `sumDuty`, so a hero taking more field time dilutes the
 * average and can lower the objective while gaining DPS itself — the same shape the farm
 * objective's served fraction has, and the same reason a plan built on it strips gear. The
 * `regime` it reports is still the true one: the caller opted out of the term, not out of knowing.
 */
function objectiveFromScores(
  scores: Record<string, HeroScore>,
  contexts: EvaluateRosterInput['contexts'],
  sumDuty: number,
  slots: number,
  ignoreFieldCrowding = false,
): { objective: number; regime: RosterRegime } {
  const optimizeIds = contexts.filter((c) => c.scope === 'optimize').map((c) => c.heroId);
  if (optimizeIds.length === 0) {
    return { objective: 0, regime: 'underSaturated' };
  }

  if (ignoreFieldCrowding) {
    let objective = 0;
    for (const id of optimizeIds) {
      objective += scores[id]?.sustained ?? 0;
    }
    return { objective, regime: sumDuty < slots ? 'underSaturated' : 'saturated' };
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

/**
 * A cheap, approximate roster objective for ranking candidate moves — the screen behind the
 * solver's beam (see `SolverBudget.beamWidth`).
 *
 * Two approximations against `evaluateRoster`: it runs ONE round instead of the aura fixed
 * point, and it rescores only the heroes the move touches, reusing `base.perHero` for everyone
 * else. That makes it ~19x cheaper than a full evaluation, and it is why the result is only a
 * ranking hint — the aura feedback a gear change induces in the rest of the roster is ignored.
 * Never let this value reach a plan: it decides which candidates are worth evaluating properly,
 * and every candidate that survives is then scored by `evaluateRoster` as usual.
 *
 * `input.loadoutsByHeroId` only needs entries for `changedHeroIds`.
 */
export function screenRosterObjective(
  input: EvaluateRosterInput,
  base: RosterEvaluation,
  changedHeroIds: readonly string[],
): number {
  if (input.farmObjective) {
    const changedLoadouts: Record<string, Loadout> = {};
    for (const heroId of changedHeroIds) {
      changedLoadouts[heroId] = loadoutForScoring(
        input.loadoutsByHeroId[heroId] ?? {},
        input.forgeFloor,
      );
    }
    return screenFarmObjective(
      input.farmObjective,
      base.farmFacts,
      base.farmPhase ?? null,
      changedLoadouts,
      input.ptsByHeroId,
      changedHeroIds,
      input.scoreMemo,
    );
  }

  const slots = Math.max(1, Math.round(input.slots));
  const scores: Record<string, HeroScore> = { ...base.perHero };
  let sumDuty = base.sumDuty;
  // The incumbent's duties are fixed for this whole call (only `sumDuty` and `scores` accumulate
  // as `changedHeroIds` is walked) — every hero reads the SAME roster total (PR #139), so this
  // is computed once, not once per changed hero. The incumbent's field pulse is reused the same
  // way: a move changes a carrier's stint by a few percent, and the pulse it lights by less.
  const auras = computeRosterAuras(input.contexts, base.dutyByHeroId, input.aurasAtCap);
  const allies = alliesByHeroId(input.contexts, base.dutyByHeroId, slots);

  for (const heroId of changedHeroIds) {
    const ctx = input.contexts.find((candidate) => candidate.heroId === heroId);
    if (!ctx || ctx.scope !== 'optimize') continue;
    const loadout = loadoutForScoring(input.loadoutsByHeroId[heroId] ?? {}, input.forgeFloor);
    const pts = input.ptsByHeroId[heroId] ?? ctx.pts;
    const raw = scoreHeroLoadout(ctx, loadout, pts, auras, input.farm, input.scoreMemo, allies[heroId]);
    sumDuty += raw.duty - (base.perHero[heroId]?.duty ?? 0);
    scores[heroId] = applyFieldPulse(raw, base.entryPulseMult);
  }

  return objectiveFromScores(scores, input.contexts, sumDuty, slots, input.ignoreFieldCrowding).objective;
}

/**
 * A leave-alone hero's loadout is priced as it stands — no forge floor, since the search never
 * touches its gear — and only for the stint its aura and its pulse are weighted by; nothing it
 * scores reaches the objective. `loadoutsByHeroId` must carry it, the same contract the gold
 * objective's bridge has: absent, the hero is priced naked, which the gold objective tolerates
 * the same way.
 */
function leaveAloneStint(
  ctx: HeroPlanContext,
  input: EvaluateRosterInput,
  auras: Record<TeamBuffId, number>,
  memo: ScoreMemo,
  fieldAllies: number,
): Stint {
  const loadout = input.loadoutsByHeroId[ctx.heroId] ?? {};
  const score = scoreHeroLoadout(ctx, loadout, ctx.pts, auras, input.farm, memo, fieldAllies);
  return { fieldSeconds: score.fieldSeconds, duty: score.duty };
}

export function evaluateRoster(input: EvaluateRosterInput): RosterEvaluation {
  const slots = Math.max(1, Math.round(input.slots));
  const memo = input.scoreMemo ?? createScoreMemo();
  const optimizeContexts = input.contexts.filter((ctx) => ctx.scope === 'optimize');
  const leaveAloneContexts = input.contexts.filter((ctx) => ctx.scope === 'leaveAlone');
  // Loop-invariant: the forge-floored loadout depends only on the input loadout and the forge
  // floor, neither of which the fixed-point rounds touch. Building it inside the round loop
  // rebuilt every hero's loadout four times per evaluation for nothing.
  const scoringLoadouts = scoringLoadoutsFor(
    optimizeContexts,
    input.loadoutsByHeroId,
    input.forgeFloor,
  );
  const duties: Record<string, number> = {};
  let perHero: Record<string, HeroScore> = {};
  let sumDuty = 0;
  let entryPulseMult = 1;

  for (let round = 0; round < AURA_FIXED_POINT_ROUNDS; round++) {
    const prevSumDuty = sumDuty;
    sumDuty = 0;
    const roundScores: Record<string, HeroScore> = {};
    const nextDuties: Record<string, number> = {};

    // Every hero reads the SAME roster total this round (PR #139) — `duties` is fixed for
    // the whole round (only `nextDuties` accumulates as heroes are scored), so this is hoisted
    // out of the per-hero loop below rather than recomputed once per hero.
    const roundAuras = computeRosterAuras(input.contexts, duties, input.aurasAtCap);
    const roundAllies = alliesByHeroId(input.contexts, duties, slots);
    const stints: Record<string, Stint> = {};
    for (const ctx of optimizeContexts) {
      const loadout = scoringLoadouts[ctx.heroId];
      const pts = input.ptsByHeroId[ctx.heroId] ?? ctx.pts;
      const raw = scoreHeroLoadout(ctx, loadout, pts, roundAuras, input.farm, memo, roundAllies[ctx.heroId]);
      roundScores[ctx.heroId] = raw;
      stints[ctx.heroId] = raw;
      nextDuties[ctx.heroId] = raw.duty;
      sumDuty += raw.duty;
    }

    // A leave-alone hero fields too (`isSquadScope`), so its aura is weighted by its own duty —
    // which the round's auras move through Fôlego like everyone else's, hence per round.
    for (const ctx of leaveAloneContexts) {
      const stint = leaveAloneStint(ctx, input, roundAuras, memo, roundAllies[ctx.heroId]);
      stints[ctx.heroId] = stint;
      nextDuties[ctx.heroId] = stint.duty;
    }

    // Unlike the auras, which each hero's sheet needs BEFORE it is scored and so read the previous
    // round's duties, the pulse scales a finished score, so it reads this round's stints.
    entryPulseMult = computeFieldPulse(input.contexts, stints, input.aurasAtCap).expectedMult;
    for (const heroId of Object.keys(roundScores)) {
      roundScores[heroId] = applyFieldPulse(roundScores[heroId], entryPulseMult);
    }

    Object.assign(duties, nextDuties);
    perHero = roundScores;

    if (round > 0 && Math.abs(sumDuty - prevSumDuty) < DUTY_EPSILON) {
      break;
    }
  }

  const { objective, regime } = objectiveFromScores(
    perHero,
    input.contexts,
    sumDuty,
    slots,
    input.ignoreFieldCrowding,
  );
  const auras = computeRosterAuras(input.contexts, duties, input.aurasAtCap);
  const evaluation: RosterEvaluation = {
    objective,
    regime,
    sumDuty,
    slots,
    perHero,
    auras,
    entryPulseMult,
    dutyByHeroId: duties,
  };
  if (!input.farmObjective) return evaluation;

  // The farm objective replaces the scalar the solver compares, and nothing else: `regime`,
  // `sumDuty` and `perHero` keep describing the roster's DPS state, which is what the waterfall's
  // per-hero table and the point passes read.
  const farm = evaluateFarmObjective(
    input.farmObjective,
    scoringLoadouts,
    input.ptsByHeroId,
    memo,
  );
  return { ...evaluation, objective: farm.objective, farmPhase: farm.phase, farmFacts: farm.facts };
}
