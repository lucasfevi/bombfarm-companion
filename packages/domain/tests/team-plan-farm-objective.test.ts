/**
 * WHICH CLAIMS HERE ARE REGIME-BOUND, AND WHY THEY ARE NOT ALL OF THEM.
 *
 * `MECHANICS.sheet` withdraws a pre-2026-08-28 capture as the source of a NUMBER about anything
 * derived from a composed hero sheet, and it names team plans outright. That reaches the gain
 * claims below and nothing else here:
 *
 *   - a CROSS-PATH IDENTITY (the bridge equals the estimator, farm mode equals dps mode where it
 *     must, a plan is reproducible run to run) compares two computations of the same arithmetic
 *     on the same inputs. A patch moves both sides together, so the claim survives it and the
 *     assertion is worth more on more accounts, not fewer;
 *   - a GAIN says the game rewards this plan by this much, which is a statement about the game on
 *     the capture's date. Those run only on captures at or past the boundary, checked mechanically
 *     rather than by a hand-kept list.
 */
import { describe, expect, it } from 'vitest';
import {
  computeHeroFarmBases,
  farmTeamBuffs,
  heroFactsFromBasis,
  squadFactsFromBases,
} from '@bombfarm/domain/farm-rate';
import {
  bestFarmPhase,
  resolveFarmObjective,
  type FarmObjectiveScales,
} from '@bombfarm/domain/farm-optimize-objective';
import { evaluateRoster, loadoutForScoring } from '@bombfarm/domain/team-plan/evaluate';
import {
  buildFarmObjective,
  evaluateFarmObjective,
  isSquadScope,
} from '@bombfarm/domain/team-plan/farm-objective';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { createScoreMemo, scoreHeroLoadout } from '@bombfarm/domain/team-plan/score';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import type { Loadout, PointAlloc } from '@bombfarm/domain/gear/types';
import type {
  EvaluateRosterInput,
  TeamPlanFarmObjective,
  TeamPlanInput,
} from '@bombfarm/domain/team-plan/types';
import { assertInRegime } from './helpers/capture-regime';
import {
  loadTeamPlanFarmFixture,
  type TeamPlanFarmFixture,
  type TeamPlanFarmFixtureOptions,
} from './helpers/team-plan-farm-fixtures';

const GOLD = resolveFarmObjective({ kind: 'gold' });
const UNUSED_SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

/**
 * Every committed capture the importer accepts. The bridge is a cross-path IDENTITY, not a
 * measured value, so it is asserted on the whole corpus rather than on the in-regime subset: a
 * capture the game has since patched away still exercises the arithmetic, and a bridge that
 * agrees on ten accounts and not an eleventh is the interesting case.
 */
const CAPTURES = [
  'save-20260818-12heroes.json',
  'save-20260819-11882-7heroes.json',
  'save-20260819-respec-crit-cdr.json',
  'save-20260822-15heroes-tree-crit-dmg.json',
  'save-20260823-13heroes-crit-points.json',
  'save-20260825-11heroes-one-shot-spread.json',
  'save-20260828-4heroes-postpatch.json',
  'save-20260831-13heroes-soulbound.json',
];

/** The two captures at or past the 2026-08-28 damage boundary — the only ones a gain may be
 *  measured on. Both are named to `skipUnlessInRegime` rather than trusted. */
const GAIN_CAPTURES = [
  'save-20260828-4heroes-postpatch.json',
  'save-20260831-13heroes-soulbound.json',
];

// Loud rather than skipped: admissible captures exist, so a boundary moving past these two is a
// one-line re-point, and a red is what prompts it.
for (const file of GAIN_CAPTURES) assertInRegime(`sheet-math/${file}`, 'sheet');

/** Every ability the team-aura pricing reads. Strip all four and the aura vector is all-zero,
 *  which is the state under which two differently-contexted score keys can collide. */
const TEAM_AURA_ABILITIES = [
  'grito_guerra',
  'pressagio_mortal',
  'marcha_acelerada',
  'folego_mineiro',
];

type Bridged = {
  objective: TeamPlanFarmObjective;
  loadouts: Record<string, Loadout>;
  pts: Record<string, PointAlloc>;
};

function bridgeFor(input: TeamPlanInput): Bridged {
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) throw new Error(`blocked: ${built.heroNames.join(', ')}`);
  const squad = built.contexts.filter((ctx) => isSquadScope(ctx.scope));
  const loadouts: Record<string, Loadout> = {};
  const pts: Record<string, PointAlloc> = {};
  for (const hero of input.heroes) {
    loadouts[hero.heroId] = loadoutForScoring(hero.loadout, 0);
    pts[hero.heroId] = hero.pts;
  }
  return { objective: buildFarmObjective(squad, input.account, loadouts), loadouts, pts };
}

/** `evaluateRoster` in farm mode on the UNCHANGED roster — the solver's own entry, sharing one
 *  `ScoreMemo` between the damage pass and the farm pass exactly as the search does. */
function rosterFarmObjective(fixture: TeamPlanFarmFixture): number {
  const input = fixture.teamPlanInput;
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) throw new Error(`blocked: ${built.heroNames.join(', ')}`);
  const { objective, loadouts, pts } = bridgeFor(input);
  const evalInput: EvaluateRosterInput = {
    contexts: built.contexts,
    loadoutsByHeroId: loadouts,
    ptsByHeroId: pts,
    slots: input.account.fieldSlots,
    farm: {
      houseIdx: input.account.houseIdx,
      houseLevel: input.account.houseLevel,
      phase: input.account.phase,
      mitigationPct: input.account.mitigationPct,
      cycleSecs: input.account.cycleSecs,
      cycleSecsHouseIdx: input.account.cycleSecsHouseIdx,
      cycleSecsLevel: input.account.cycleSecsLevel,
    },
    forgeFloor: input.forgeFloor,
    farmObjective: objective,
  };
  return evaluateRoster(evalInput).objective;
}

/** `run.elapsedMs` is wall clock and the only field two identical runs may legitimately disagree
 *  on — it is reported, never read by anything that decides. */
function planWithoutClock(result: ReturnType<typeof runTeamPlan>) {
  if (result.blocked) return result;
  return { ...result, plan: { ...result.plan, run: { ...result.plan.run, elapsedMs: 0 } } };
}

/** The ordinary farm path — the estimator's own entry, with no Team Plan code in it. */
function ordinaryFarmPath(fixture: TeamPlanFarmFixture) {
  const bases = computeHeroFarmBases({
    heroes: fixture.heroes,
    account: fixture.account,
    enabledHeroIds: fixture.enabledHeroIds,
  });
  const squad = squadFactsFromBases(bases, null, fixture.account);
  const pick = bestFarmPhase(squad, GOLD, UNUSED_SCALES, { maxPhase: fixture.account.maxPhase });
  return {
    facts: bases.map((basis) => heroFactsFromBasis(basis, basis.pts)),
    goldPerHour: pick ? pick.value : 0,
    phase: pick ? pick.phase : null,
  };
}

/** Gold/hr of a roster whose loadouts have been replaced by `proposedLoadouts`, via the ordinary
 *  path — the plan is measured on the estimator, never on the bridge that produced it. */
function goldPerHourWithLoadouts(
  fixture: TeamPlanFarmFixture,
  loadoutByHeroId: Record<string, Loadout>,
): number {
  const heroes = fixture.heroes.map((hero) => ({
    ...hero,
    loadout: loadoutByHeroId[hero.id] ?? hero.loadout,
  }));
  const bases = computeHeroFarmBases({
    heroes,
    account: fixture.account,
    enabledHeroIds: fixture.enabledHeroIds,
  });
  const squad = squadFactsFromBases(bases, null, fixture.account);
  const pick = bestFarmPhase(squad, GOLD, UNUSED_SCALES, {
    maxPhase: fixture.account.maxPhase,
    exhaustive: true,
  });
  return pick ? pick.value : 0;
}

describe('the Team Plan farm objective reproduces the estimator on an unchanged roster', () => {
  it.each(CAPTURES)('%s — same per-hero farm facts, same phase, same gold/hr', (file) => {
    const fixture = loadTeamPlanFarmFixture(file);
    const ordinary = ordinaryFarmPath(fixture);
    const { objective, loadouts, pts } = bridgeFor(fixture.teamPlanInput);
    const bridged = evaluateFarmObjective(objective, loadouts, pts, undefined);

    expect(bridged.facts).toEqual(ordinary.facts);
    expect(bridged.phase).toBe(ordinary.phase);
    expect(bridged.objective).toBe(ordinary.goldPerHour);
    expect(ordinary.goldPerHour).toBeGreaterThan(0);
  });

  it.each(CAPTURES)('%s — the frozen auras are the estimator\'s rotation-priced totals', (file) => {
    const fixture = loadTeamPlanFarmFixture(file);
    const { objective } = bridgeFor(fixture.teamPlanInput);
    expect(objective.auras).toEqual(
      farmTeamBuffs({
        heroes: fixture.heroes,
        account: fixture.account,
        enabledHeroIds: fixture.enabledHeroIds,
      }),
    );
  });

  it.each(CAPTURES)(
    '%s — with no aura carrier at all, the solver entry still equals the estimator',
    (file) => {
      const options: TeamPlanFarmFixtureOptions = { stripAbilities: TEAM_AURA_ABILITIES };
      const fixture = loadTeamPlanFarmFixture(file, options);
      const { objective } = bridgeFor(fixture.teamPlanInput);
      expect(Object.values(objective.auras).every((value) => value === 0)).toBe(true);
      const ordinary = ordinaryFarmPath(fixture);
      expect(ordinary.goldPerHour).toBeGreaterThan(0);
      expect(rosterFarmObjective(fixture)).toBe(ordinary.goldPerHour);
    },
  );
});

/**
 * A run holds TWO farm contexts: the damage pass scores against the account's own phase and
 * mitigation, the farm objective against phase 1 / mitigation 0. Both go through one `ScoreMemo`,
 * and both reach it with an all-zero aura vector whenever no scoped hero carries a team-buff
 * ability — which is the state the corpus cannot exhibit on its own, since every committed
 * capture has a carrier.
 */
describe('the score memo never serves a score computed against another farm context', () => {
  const dpsContext = (input: TeamPlanInput) => ({
    houseIdx: input.account.houseIdx,
    houseLevel: input.account.houseLevel,
    phase: input.account.phase,
    mitigationPct: input.account.mitigationPct,
    cycleSecs: input.account.cycleSecs,
    cycleSecsHouseIdx: input.account.cycleSecsHouseIdx,
    cycleSecsLevel: input.account.cycleSecsLevel,
  });

  it.each(CAPTURES)('%s', (file) => {
    const fixture = loadTeamPlanFarmFixture(file, { stripAbilities: TEAM_AURA_ABILITIES });
    const input = fixture.teamPlanInput;
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) throw new Error(`blocked: ${built.heroNames.join(', ')}`);
    const auras = zeroTeamBuffs();
    const atAccount = dpsContext(input);
    const atFarm = { ...atAccount, phase: 1, mitigationPct: 0 };
    const memo = createScoreMemo();

    let differing = 0;
    for (const ctx of built.contexts) {
      const loadout = loadoutForScoring(
        input.heroes.find((hero) => hero.heroId === ctx.heroId)!.loadout,
        0,
      );
      const memoFree = scoreHeroLoadout(ctx, loadout, ctx.pts, auras, atFarm);
      scoreHeroLoadout(ctx, loadout, ctx.pts, auras, atAccount, memo);
      expect(scoreHeroLoadout(ctx, loadout, ctx.pts, auras, atFarm, memo)).toEqual(memoFree);
      if (scoreHeroLoadout(ctx, loadout, ctx.pts, auras, atAccount).sustained !== memoFree.sustained) {
        differing++;
      }
    }
    // Non-vacuity: the two contexts really do score this roster differently, so a memo that
    // could not tell them apart would have been caught above rather than agreeing by accident.
    // Not every hero — a hero that lands no hit scores 0 under either phase.
    expect(differing).toBeGreaterThan(0);
  });
});

/**
 * A hero the player left alone still fields, still takes a House slot and still earns gold, so it
 * belongs to the squad the objective prices even though the search may not re-gear it. House
 * allocation, `uptimeSum` and `sorteFraction` are all nonlinear in who is present, so dropping
 * these heroes is not an offset that cancels — these accounts read tens of percent low.
 *
 * Every committed capture is uniformly optimize-scoped, so the scopes are imposed here; without
 * that the condition is unreachable and the split is untestable by construction.
 */
describe('the priced squad is who the player fields, not what the search may move', () => {
  it.each(CAPTURES)('%s — leave-alone heroes stay in the priced squad', (file) => {
    const fixture = loadTeamPlanFarmFixture(file, {
      scopeByIndex: { 0: 'leaveAlone', 2: 'leaveAlone' },
    });
    const ordinary = ordinaryFarmPath(fixture);
    const { objective, loadouts, pts } = bridgeFor(fixture.teamPlanInput);
    const bridged = evaluateFarmObjective(objective, loadouts, pts, undefined);

    expect(objective.heroes.length).toBe(fixture.enabledHeroIds.length);
    expect(bridged.facts).toEqual(ordinary.facts);
    expect(bridged.objective).toBe(ordinary.goldPerHour);
    expect(rosterFarmObjective(fixture)).toBe(ordinary.goldPerHour);
  });

  it.each(CAPTURES)('%s — donate-scope heroes leave the priced squad', (file) => {
    const fixture = loadTeamPlanFarmFixture(file, { scopeByIndex: { 1: 'donate' } });
    const ordinary = ordinaryFarmPath(fixture);
    const { objective, loadouts, pts } = bridgeFor(fixture.teamPlanInput);

    expect(objective.heroes.map((frozen) => frozen.ctx.heroId)).toEqual(fixture.enabledHeroIds);
    expect(objective.heroes.length).toBe(fixture.heroes.length - 1);
    expect(evaluateFarmObjective(objective, loadouts, pts, undefined).objective).toBe(
      ordinary.goldPerHour,
    );
  });
});

describe('farm mode refuses an unbounded phase ceiling', () => {
  it.each([null, undefined, 0, Number.NaN])('maxPhase %s is rejected', (maxPhase) => {
    const fixture = loadTeamPlanFarmFixture('save-20260828-4heroes-postpatch.json');
    const input: TeamPlanInput = {
      ...fixture.teamPlanInput,
      objective: 'farm',
      account: { ...fixture.teamPlanInput.account, maxPhase: maxPhase as number | null },
    };
    expect(() => runTeamPlan(input, { maxEvaluations: 200 })).toThrow(/account\.maxPhase/);
  });

  it('dps mode plans happily without one', () => {
    const fixture = loadTeamPlanFarmFixture('save-20260828-4heroes-postpatch.json');
    const input: TeamPlanInput = {
      ...fixture.teamPlanInput,
      account: { ...fixture.teamPlanInput.account, maxPhase: null },
    };
    const result = runTeamPlan(input, { maxEvaluations: 2_000 });
    expect(result.blocked).toBe(false);
  });
});

describe('objective selection', () => {
  it('an omitted objective and an explicit dps produce the same plan', () => {
    const fixture = loadTeamPlanFarmFixture('save-20260819-11882-7heroes.json', {
      forgeFloor: 10,
    });
    const withDefault = runTeamPlan(fixture.teamPlanInput, { maxEvaluations: 4_000 });
    const withDps = runTeamPlan(
      { ...fixture.teamPlanInput, objective: 'dps' },
      { maxEvaluations: 4_000 },
    );
    expect(planWithoutClock(withDps)).toEqual(planWithoutClock(withDefault));
  });

  it('farm mode reports gold/hr where dps mode reports damage', () => {
    const fixture = loadTeamPlanFarmFixture('save-20260819-11882-7heroes.json');
    const dps = runTeamPlan(fixture.teamPlanInput, { maxEvaluations: 2_000 });
    const farm = runTeamPlan(
      { ...fixture.teamPlanInput, objective: 'farm' },
      { maxEvaluations: 2_000 },
    );
    if (dps.blocked || farm.blocked) throw new Error('fixture blocked');
    const ordinaryGold = ordinaryFarmPath(fixture).goldPerHour;
    expect(farm.plan.currentDps).toBeGreaterThan(0);
    expect(farm.plan.currentDps).not.toBe(dps.plan.currentDps);
    // Same order of magnitude as the estimator's own figure for this account: what remains
    // between them is gear drift between the save's `loadout` and its inventory, not a unit or
    // scale difference. The exact identity is pinned by the bridge suite above.
    expect(farm.plan.currentDps / ordinaryGold).toBeGreaterThan(0.5);
    expect(farm.plan.currentDps / ordinaryGold).toBeLessThan(2);
  });
});

describe('farm mode is deterministic', () => {
  it('two identical runs return deep-equal plans', () => {
    const fixture = loadTeamPlanFarmFixture('save-20260819-11882-7heroes.json', {
      forgeFloor: 10,
    });
    const input: TeamPlanInput = { ...fixture.teamPlanInput, objective: 'farm' };
    const first = runTeamPlan(input, { maxEvaluations: 3_000 });
    const second = runTeamPlan(input, { maxEvaluations: 3_000 });
    expect(planWithoutClock(second)).toEqual(planWithoutClock(first));
  });
});

describe('a farm-mode plan does not lower the gold/hr it was chosen for', () => {
  it.each(GAIN_CAPTURES)('%s', (file) => {
    const fixture = loadTeamPlanFarmFixture(file);
    const result = runTeamPlan(
      { ...fixture.teamPlanInput, objective: 'farm' },
      { maxEvaluations: 20_000 },
    );
    if (result.blocked) throw new Error('fixture blocked');

    const before = goldPerHourWithLoadouts(
      fixture,
      Object.fromEntries(fixture.heroes.map((hero) => [hero.id, hero.loadout])),
    );
    const after = goldPerHourWithLoadouts(fixture, result.plan.proposedLoadouts);
    expect(before).toBeGreaterThan(0);
    expect(after).toBeGreaterThanOrEqual(before * (1 - 1e-9));
  });
});
