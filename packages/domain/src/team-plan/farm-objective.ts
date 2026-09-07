/**
 * The Team Plan's farm objective: gold per hour, at the best phase the squad can hold.
 *
 * The squad is every hero the player will field, whatever the search is allowed to touch — see
 * {@link isSquadScope} and {@link TeamPlanFarmObjective}.
 *
 * The chain is the farm estimator's own — per-hero facts → squad facts → best phase → gold/hr —
 * reached through the Team Plan's scorer instead of through `pipelineForHero`, because the plan
 * holds `TeamPlanHeroInput`s (no `naked`, no `gearedOverride`) and is asked for a rate on gear it
 * has not equipped anywhere. The two paths must agree exactly on an unchanged roster, and they do
 * by construction rather than by tolerance:
 *
 *   - the scorer already composes `naked`/`geared` from `birth` through `sheetsFromBirth`, which
 *     is the same branch the pipeline takes for a birth-backed hero (and the plan blocks a hero
 *     without `birth`), so the sheets entering `derive` are the same objects' values;
 *   - {@link FARM_BASIS_PHASE}/{@link FARM_BASIS_MITIGATION_PCT} reproduce the estimator's
 *     deliberate `pipelineForHero(hero, account, 1, 0)` entry, so the farm `Context` matches too;
 *   - the team auras are priced by the estimator's own two-pass rotation weighting rather than by
 *     the plan's duty-weighted fixed point, which is the one input where the two conventions
 *     genuinely differ;
 *   - and the basis itself is assembled by `heroFarmBasisFromParts`, the estimator's only
 *     construction site, so the ability, luck and blast terms cannot drift apart.
 *
 * Pure throughout: same arguments, same result, no clock, no `Math.random`, no module-level
 * mutable state. The only cache is the caller's per-run `ScoreMemo`, whose key already determines
 * its value.
 */
import {
  computeFarmRateRow,
  computeSquadFarmFacts,
  heroFactsFromBasis,
  heroFarmBasisFromParts,
  type HeroFarmBasis,
  type HeroFarmFacts,
  type SquadFarmAccount,
} from '../farm-rate';
import {
  bestFarmPhase,
  farmObjectiveValue,
  resolveFarmObjective,
  type FarmObjectiveScales,
  type ResolvedFarmObjective,
} from '../farm-optimize-objective';
import { computeCombatMults } from '../derive';
import { fieldSeconds } from '../model';
import { computeTeamBuffsOverRotation, type TeamBuffId } from '../team-buffs';
import { scoreHeroLoadout } from './score';
import type { Loadout, PointAlloc } from '../gear/types';
import type {
  FarmContext,
  FrozenHeroFarmTerms,
  HeroPlanContext,
  HeroScore,
  ScoreMemo,
  TeamPlanAccountInput,
  TeamPlanFarmObjective,
} from './types';

/**
 * The farm estimator prices every hero at phase 1 with zero mitigation, and the pair is
 * load-bearing rather than incidental: `effectiveMitigationPct` only honors a zero mitigation
 * when the phase is a positive number, and substitutes phase 1's wiki mitigation for a `null`
 * one. Phase mitigation is applied later, per row, by the rate layer.
 */
const FARM_BASIS_PHASE = 1;
const FARM_BASIS_MITIGATION_PCT = 0;

/** Gold per hour, so `farmObjectiveValue` reads `row.goldPerHour` and the scales go unread. */
export const FARM_GOLD_OBJECTIVE: ResolvedFarmObjective = resolveFarmObjective({ kind: 'gold' });
export const FARM_UNREAD_SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

export type FarmObjectiveResult = {
  objective: number;
  phase: number | null;
  facts: readonly HeroFarmFacts[];
};

function farmContextFor(account: TeamPlanAccountInput): FarmContext {
  return {
    houseIdx: account.houseIdx,
    houseLevel: account.houseLevel,
    phase: FARM_BASIS_PHASE,
    mitigationPct: FARM_BASIS_MITIGATION_PCT,
    cycleSecs: account.cycleSecs,
    cycleSecsHouseIdx: account.cycleSecsHouseIdx,
    cycleSecsLevel: account.cycleSecsLevel,
  };
}

/**
 * The phase ceiling, or a throw. There is no sane default: `FarmRateOptions` reads an absent
 * `maxPhase` as the whole 600-row wiki table, and a squad optimised for phases the account has
 * never unlocked is a plan for someone else's account. A caller that asks for gold and cannot
 * say how far the account has got is a caller that has not been wired up yet.
 */
function requireMaxPhase(account: TeamPlanAccountInput): number {
  const maxPhase = account.maxPhase;
  if (typeof maxPhase !== 'number' || !Number.isFinite(maxPhase) || maxPhase < 1) {
    throw new Error(
      "team-plan: objective 'farm' needs account.maxPhase (the account's highest unlocked " +
        `phase); got ${JSON.stringify(maxPhase)}. Without it the plan would optimise the squad ` +
        'across the whole 600-phase table.',
    );
  }
  return maxPhase;
}

function squadAccountFor(account: TeamPlanAccountInput): SquadFarmAccount {
  return {
    slots: account.slots,
    fieldSlots: account.fieldSlots,
    tree: {
      danoTotal: account.treeSheet.danoStatic,
      critChance: account.treeSheet.critChancePct,
      critDmg: account.treeSheet.critDmgPct,
      speed: account.treeSheet.speedPct,
      energy: account.treeSheet.energyPct,
      teamCoinPct: account.teamCoinPct ?? 0,
      luckFlatPct: account.treeSheet.luckFlatPct,
      xpMult: account.xpMult,
    },
  };
}

/** The estimator's own uptime expression, two-step and not "simplified" — `field / (field + rest)`
 *  is algebraically equal and not bit-equal in IEEE754. */
function presenceOf(score: HeroScore): number {
  const field = fieldSeconds(score.effective, score.context);
  return (100 * field) / (field + score.context.restSeconds) / 100;
}

/**
 * Team auras over the rotation, priced in the estimator's two passes: full presence first, then
 * weighted by the uptimes that seeding produced. Fixed at two passes, not iterated — only Fôlego
 * closes the loop back into uptime at all.
 */
function priceAuras(
  squadContexts: readonly HeroPlanContext[],
  loadoutByHeroId: Readonly<Record<string, Loadout>>,
  farm: FarmContext,
): Record<TeamBuffId, number> {
  const atFullPresence = computeTeamBuffsOverRotation(squadContexts, null);
  const presence = squadContexts.map((ctx) =>
    presenceOf(
      scoreHeroLoadout(ctx, loadoutByHeroId[ctx.heroId] ?? {}, ctx.pts, atFullPresence, farm),
    ),
  );
  return computeTeamBuffsOverRotation(squadContexts, presence);
}

/**
 * Which of the plan's heroes are on the rotation the objective prices.
 *
 * Optimize and leave-alone both farm; only donate does not. That matches the estimator's own
 * rule, which drops a hero the game will not field (`battleAllowed === false`) — the very
 * condition the plan turns into a default donate scope. An explicit Donate says the player is
 * stripping the hero for parts, so it leaves the rotation too.
 */
export function isSquadScope(scope: HeroPlanContext['scope']): boolean {
  return scope === 'optimize' || scope === 'leaveAlone';
}

/**
 * The once-per-run setup, over the SQUAD in roster order (see {@link TeamPlanFarmObjective}).
 * `loadoutByHeroId` must be the roster AS IT STANDS: it seeds the aura pricing off every hero's
 * uptime today, and it is also what a hero the search may not re-gear farms with for the whole
 * run.
 */
export function buildFarmObjective(
  squadContexts: readonly HeroPlanContext[],
  account: TeamPlanAccountInput,
  loadoutByHeroId: Readonly<Record<string, Loadout>>,
): TeamPlanFarmObjective {
  const maxPhase = requireMaxPhase(account);
  const farm = farmContextFor(account);
  const auras = priceAuras(squadContexts, loadoutByHeroId, farm);
  const heroes: FrozenHeroFarmTerms[] = squadContexts.map((ctx) => ({
    ctx,
    dmgMult: computeCombatMults({ mods: ctx.mods, teamBuffs: auras, extraDmgPct: 0 }).dmgMult,
    ...(ctx.scope === 'optimize' ? {} : { fixedLoadout: loadoutByHeroId[ctx.heroId] ?? {} }),
  }));

  return {
    auras,
    farm,
    account: squadAccountFor(account),
    phaseOptions: { maxPhase },
    treeLuckFlatPct: account.treeSheet.luckFlatPct,
    heroes,
  };
}

function loadoutFor(
  frozen: FrozenHeroFarmTerms,
  loadoutByHeroId: Readonly<Record<string, Loadout>>,
): Loadout {
  return frozen.fixedLoadout ?? loadoutByHeroId[frozen.ctx.heroId] ?? {};
}

/**
 * One hero's farm basis for a candidate loadout and point vector.
 *
 * The basis is handed the scorer's own sheet as its base point AND the same `pts` it was scored
 * at, so `heroFactsFromBasis`'s affine reconstruction at that vector reduces to
 * `effective[key] + 0 × delta` — the sheet is used verbatim, not re-derived from a different
 * anchor. At any OTHER vector the reconstruction is exact rather than approximate, which is what
 * lets a point search read candidates off this basis without re-entering the scorer.
 */
function basisForHero(
  objective: TeamPlanFarmObjective,
  frozen: FrozenHeroFarmTerms,
  loadout: Loadout,
  pts: PointAlloc,
  memo: ScoreMemo | undefined,
): HeroFarmBasis {
  const ctx = frozen.ctx;
  const score = scoreHeroLoadout(ctx, loadout, pts, objective.auras, objective.farm, memo);
  return heroFarmBasisFromParts({
    heroId: ctx.heroId,
    heroName: ctx.name,
    level: ctx.level,
    pts,
    effective: score.effective,
    effectiveDelta: score.effectiveDelta,
    context: score.context,
    dmgMult: frozen.dmgMult,
    adjustedLuckPct: score.adjusted.luck,
    treeLuckFlatPct: objective.treeLuckFlatPct,
    abilities: ctx.abilities,
  });
}

function factsForHero(
  objective: TeamPlanFarmObjective,
  frozen: FrozenHeroFarmTerms,
  loadout: Loadout,
  pts: PointAlloc,
  memo: ScoreMemo | undefined,
): HeroFarmFacts {
  return heroFactsFromBasis(basisForHero(objective, frozen, loadout, pts, memo), pts);
}

/**
 * The squad's farm bases for a candidate build, in the same order {@link evaluateFarmObjective}
 * prices them.
 *
 * The point pass needs the bases and not the facts: a fact is one vector's answer, whereas a basis
 * scores every vector the search will try. `heroFactsFromBasis(basis, basis.pts)` recovers exactly
 * what {@link evaluateFarmObjective} would have produced for this same build, so the two entry
 * points cannot describe different squads.
 */
export function farmBasesForBuild(
  objective: TeamPlanFarmObjective,
  loadoutByHeroId: Readonly<Record<string, Loadout>>,
  ptsByHeroId: Readonly<Record<string, PointAlloc>>,
  memo: ScoreMemo | undefined,
): HeroFarmBasis[] {
  return objective.heroes.map((frozen) =>
    basisForHero(
      objective,
      frozen,
      loadoutFor(frozen, loadoutByHeroId),
      ptsByHeroId[frozen.ctx.heroId] ?? frozen.ctx.pts,
      memo,
    ),
  );
}

function valueAt(
  objective: TeamPlanFarmObjective,
  facts: readonly HeroFarmFacts[],
  phase: number,
): number {
  const row = computeFarmRateRow(phase, computeSquadFarmFacts(facts, objective.account), objective.phaseOptions);
  if (row === null || row.infeasible) return 0;
  const value = farmObjectiveValue(row, FARM_GOLD_OBJECTIVE, FARM_UNREAD_SCALES);
  return Number.isFinite(value) ? value : 0;
}

/**
 * The full farm evaluation: every squad hero's facts, then the phase argmax over them.
 *
 * `bestFarmPhase` runs at its default stride, which screens the world openers and refines one
 * world either side. `exhaustive` is deliberately NOT passed — inside a search a screen miss only
 * bends the trajectory, and the sweep is the overwhelming majority of a farm evaluation's cost.
 */
export function evaluateFarmObjective(
  objective: TeamPlanFarmObjective,
  loadoutByHeroId: Readonly<Record<string, Loadout>>,
  ptsByHeroId: Readonly<Record<string, PointAlloc>>,
  memo: ScoreMemo | undefined,
): FarmObjectiveResult {
  const facts = objective.heroes.map((frozen) =>
    factsForHero(
      objective,
      frozen,
      loadoutFor(frozen, loadoutByHeroId),
      ptsByHeroId[frozen.ctx.heroId] ?? frozen.ctx.pts,
      memo,
    ),
  );

  const squad = computeSquadFarmFacts(facts, objective.account);
  const pick = bestFarmPhase(squad, FARM_GOLD_OBJECTIVE, FARM_UNREAD_SCALES, objective.phaseOptions);
  return { objective: pick ? pick.value : 0, phase: pick ? pick.phase : null, facts };
}

/**
 * The screen behind the solver's beam, in farm mode.
 *
 * TWO approximations against {@link evaluateFarmObjective}, and the second is the point of this
 * function: only the heroes a move touches are rescored (the rest reuse the incumbent's facts),
 * and the squad is priced at the INCUMBENT'S OWN best phase rather than swept. The sweep is ~96%
 * of a farm evaluation, so screening with it would cost as much as evaluating properly and delete
 * the beam's entire reason to exist. A move that would have shifted the argmax is under-rated
 * here, but only in the ranking: every survivor is scored by `evaluateFarmObjective` with the
 * sweep as usual.
 *
 * That under-rating has been measured and costs nothing on this corpus. Rerunning five committed
 * captures with the beam switched off — every move fully evaluated, 13.5x to 30x the evaluations
 * — produced identical plans, and the screen's top 24 contained the globally best move every
 * time. So this is a speed-up that is not paying for itself in plan quality, and it is NOT the
 * reason a farm plan lands short of a greedy reference; that cause is not established.
 */
export function screenFarmObjective(
  objective: TeamPlanFarmObjective,
  baseFacts: readonly HeroFarmFacts[] | undefined,
  basePhase: number | null,
  changedLoadouts: Readonly<Record<string, Loadout>>,
  ptsByHeroId: Readonly<Record<string, PointAlloc>>,
  changedHeroIds: readonly string[],
  memo: ScoreMemo | undefined,
): number {
  if (baseFacts === undefined || baseFacts.length !== objective.heroes.length) {
    throw new Error(
      `team-plan farm screen: the incumbent carries ${baseFacts?.length ?? 'no'} hero farm facts ` +
        `for a ${objective.heroes.length}-hero squad. The evaluation it came from was produced ` +
        'without this objective.',
    );
  }
  const changed = new Set(changedHeroIds);
  const facts = objective.heroes.map((frozen, index) => {
    const heroId = frozen.ctx.heroId;
    if (!changed.has(heroId)) return baseFacts[index];
    return factsForHero(
      objective,
      frozen,
      loadoutFor(frozen, changedLoadouts),
      ptsByHeroId[heroId] ?? frozen.ctx.pts,
      memo,
    );
  });

  // No incumbent phase means the incumbent farms nothing, so there is no phase to price at.
  // Phase 1 is the easiest one and therefore the one a move is likeliest to make feasible, which
  // is exactly what the ranking needs to detect; a candidate that cannot hold it scores 0 and
  // ranks last on its own.
  return valueAt(objective, facts, basePhase ?? 1);
}
