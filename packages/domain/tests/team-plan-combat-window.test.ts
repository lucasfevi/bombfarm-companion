/**
 * The two windowed objectives — a gate clear over the act's timer, the one-minute duel — against
 * the rotation objective they replace on the Optimizer. Every claim is about the SEARCH: what the
 * window does to the scoring context, to a hero's own figure, and to what the point pass buys.
 */
import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import { planFieldSlots, resolveCombatWindow } from '@bombfarm/domain/team-plan/combat-window';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import { PVP_TOP_HOUSE_SQUAD_SLOTS, PVP_WINDOW_SECS, defaultGatePhase, gateWindowSecs, pvpSquadSlots } from '@bombfarm/domain/combat-window';
import { fieldPresence, fieldSeconds, sustainedDps, type Context, type HeroSheet } from '@bombfarm/domain/model';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import type { TeamPlanInput, TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

const CAPTURE = 'save-20260819-11882-7heroes.json';

function inputFor(): TeamPlanInput {
  return loadTeamPlanFarmFixture(CAPTURE).teamPlanInput;
}

function planFor(input: TeamPlanInput, objective: TeamPlanObjective, targetPhase: number | null, ignoreFieldCrowding = false) {
  const result = runTeamPlan({ ...input, objective, targetPhase, allowedChanges: 'points', ignoreFieldCrowding });
  if (result.blocked) throw new Error(`plan blocked: ${result.heroNames.join(', ')}`);
  return result.plan;
}

const sheet: HeroSheet = {
  rarity: 'Épico',
  attack: 1000,
  energy: 90,
  speed: 100,
  critChance: 10,
  critDmg: 50,
  penetration: 0,
  cdr: 0,
  attackPerPoint: 10,
  energyPerPoint: 3,
};
const rotation: Context = { restSeconds: 300, mitigation: 0.1, blastRange: 1, ato: 1, drainMult: 1 };

describe('sustainedDps over a window', () => {
  it('is the rotation figure with an infinite horizon, and the window-average rate with a finite one', () => {
    expect(fieldPresence(sheet, rotation)).toBeCloseTo(90 / 390, 12);
    const duel = { ...rotation, windowSecs: PVP_WINDOW_SECS };
    expect(fieldSeconds(sheet, duel)).toBeGreaterThan(PVP_WINDOW_SECS);
    expect(fieldPresence(sheet, duel)).toBe(1);
    expect(sustainedDps(sheet, duel)).toBeGreaterThan(sustainedDps(sheet, rotation));
    const long = { ...rotation, windowSecs: 1e9 };
    expect(fieldPresence(sheet, long)).toBeCloseTo(fieldPresence(sheet, rotation), 6);
  });

  it('energy past what the window can spend earns nothing, and energy inside it still does', () => {
    const duel = { ...rotation, windowSecs: PVP_WINDOW_SECS };
    expect(sustainedDps({ ...sheet, energy: 200 }, duel)).toBe(sustainedDps(sheet, duel));
    const short = { ...sheet, energy: 30 };
    expect(sustainedDps({ ...short, energy: 45 }, duel)).toBeGreaterThan(sustainedDps(short, duel));
  });
});

describe('resolveCombatWindow', () => {
  const input = inputFor();

  it('a gate clear fights the chosen gate over its act’s timer', () => {
    expect(resolveCombatWindow({ ...input, objective: 'gateClear', targetPhase: 60 })).toEqual({ phase: 60, windowSecs: 540, fieldSlots: null });
    expect(resolveCombatWindow({ ...input, objective: 'gateClear', targetPhase: 10 })).toEqual({ phase: 10, windowSecs: 600, fieldSlots: null });
  });

  it('a phase that is not a gate, or none, resolves to the account’s next gate', () => {
    const accountPhase = input.account.phase ?? 1;
    const next = defaultGatePhase(accountPhase);
    expect(wikiPhaseLine(next)?.gate).toBe(true);
    expect(resolveCombatWindow({ ...input, objective: 'gateClear', targetPhase: null })).toEqual({ phase: next, windowSecs: gateWindowSecs(next), fieldSlots: null });
    expect(resolveCombatWindow({ ...input, objective: 'gateClear', targetPhase: 11 })).toEqual({ phase: next, windowSecs: gateWindowSecs(next), fieldSlots: null });
  });

  it('a duel is always one minute in a room seating the squad’s slots, at the chosen phase or the account’s', () => {
    expect(resolveCombatWindow({ ...input, objective: 'pvp', targetPhase: 220, pvpSquadSlots: 6 })).toEqual({ phase: 220, windowSecs: 60, fieldSlots: 6 });
    expect(resolveCombatWindow({ ...input, objective: 'pvp', targetPhase: null, pvpSquadSlots: 4 })).toEqual({ phase: input.account.phase, windowSecs: 60, fieldSlots: 4 });
    expect(planFieldSlots({ ...input, objective: 'pvp', targetPhase: null, pvpSquadSlots: 6 })).toBe(6);
  });

  it('with no squad slots read, a duel seats the top squad house’s nine', () => {
    expect(PVP_TOP_HOUSE_SQUAD_SLOTS).toBe(9);
    expect(resolveCombatWindow({ ...input, objective: 'pvp', targetPhase: 220 })).toEqual({ phase: 220, windowSecs: 60, fieldSlots: 9 });
    expect(planFieldSlots({ ...input, objective: 'pvp', targetPhase: null, pvpSquadSlots: null })).toBe(9);
  });

  it('the squad slots reach only the duel: a gate clear and the rotations keep the account’s field', () => {
    for (const objective of ['gateClear', 'dps', 'farm'] as const) {
      expect(planFieldSlots({ ...input, objective, targetPhase: null, pvpSquadSlots: 2 })).toBe(input.account.fieldSlots);
    }
  });

  it('the rotation objectives have no window', () => {
    expect(resolveCombatWindow({ ...input, objective: 'dps', targetPhase: 60 })).toBeNull();
    expect(resolveCombatWindow({ ...input, objective: 'farm', targetPhase: 60 })).toBeNull();
    expect(resolveCombatWindow({ ...input, objective: undefined, targetPhase: null })).toBeNull();
  });

  it('the window reaches the scoring context, with the gate’s own mitigation', () => {
    const gate = farmFromAccount({ ...input, objective: 'gateClear', targetPhase: 60 });
    expect(gate.windowSecs).toBe(540);
    expect(gate.phase).toBe(60);
    expect(gate.mitigationPct).toBe((wikiPhaseLine(60)?.mitig ?? 0) * 100);
    expect(farmFromAccount({ ...input, objective: 'dps', targetPhase: 60 }).windowSecs).toBeUndefined();
  });
});

describe('runTeamPlan under a combat window', () => {
  const input = inputFor();

  it('a duel plan reports the duel phase, and a gate plan the gate it resolved to', () => {
    const duel = planFor(input, 'pvp', 220);
    expect(duel.scoredPhase).toBe(220);
    expect(duel.scoredPhaseSource).toBe('chosen');

    const gate = planFor(input, 'gateClear', 60);
    expect(gate.scoredPhase).toBe(60);
    expect(gate.scoredPhaseSource).toBe('chosen');

    const nextGate = planFor(input, 'gateClear', null);
    expect(nextGate.scoredPhase).toBe(defaultGatePhase(input.account.phase ?? 1));
    expect(nextGate.scoredPhaseSource).toBe('account');
  });

  it('every hero whose stint outlasts the minute is on the field for the whole duel', () => {
    const optimizeCount = Object.values(input.scopeByHeroId).filter((scope) => scope === 'optimize').length;
    expect(optimizeCount).toBeGreaterThan(0);
    const duel = planFor(input, 'pvp', 60);
    expect(duel.sumDuty).toBeCloseTo(optimizeCount, 9);
    const rotation = planFor(input, 'dps', 60);
    expect(rotation.sumDuty).toBeLessThan(optimizeCount);
  });

  it('a minute beats a gate timer beats a rotation: the longer the horizon, the more of it is rest', () => {
    const duel = planFor(input, 'pvp', 60);
    const gate = planFor(input, 'gateClear', 60);
    const rotation = planFor(input, 'dps', 60);
    expect(duel.currentDps).toBeGreaterThan(gate.currentDps);
    expect(gate.currentDps).toBeGreaterThan(rotation.currentDps);
  });

  it('the duel room seats the squad whatever the account’s field: a squad the field could not seat all fights at once', () => {
    const optimizeCount = Object.values(input.scopeByHeroId).filter((scope) => scope === 'optimize').length;
    expect(optimizeCount).toBeGreaterThan(input.account.fieldSlots);
    const duel = planFor(input, 'pvp', 60);
    expect(duel.slots).toBe(PVP_TOP_HOUSE_SQUAD_SLOTS);
    expect(duel.regime).toBe('underSaturated');
    expect(duel.currentDps).toBe(planFor(input, 'pvp', 60, true).currentDps);
    // The same squad on the account's own field would have to share its slots.
    expect(planFor(input, 'gateClear', 60).regime).toBe('saturated');
  });

  it('a six-slot squad is scored on a six-seat room: six fielded all fight at once, a seventh would share', () => {
    const fielded = Object.keys(input.scopeByHeroId).filter((id) => input.scopeByHeroId[id] !== 'donate');
    expect(fielded.length).toBeGreaterThanOrEqual(7);
    const squadOf = (count: number): TeamPlanInput['scopeByHeroId'] =>
      Object.fromEntries(fielded.map((id, index) => [id, index < count ? input.scopeByHeroId[id]! : 'donate']));
    const sixSlots = { ...input, pvpSquadSlots: 6 };
    const crowdingCost = (plan: { currentDps: number }, uncrowded: { currentDps: number }) =>
      1 - plan.currentDps / uncrowded.currentDps;

    const six = { ...sixSlots, scopeByHeroId: squadOf(6) };
    expect(planFor(six, 'pvp', 60).slots).toBe(6);
    expect(crowdingCost(planFor(six, 'pvp', 60), planFor(six, 'pvp', 60, true))).toBeCloseTo(0, 12);

    const seven = { ...sixSlots, scopeByHeroId: squadOf(7) };
    expect(planFor(seven, 'pvp', 60).slots).toBe(6);
    expect(crowdingCost(planFor(seven, 'pvp', 60), planFor(seven, 'pvp', 60, true))).toBeGreaterThan(0.1);
    // The same seven in the top house's room all fit.
    expect(planFor({ ...input, scopeByHeroId: squadOf(7) }, 'pvp', 60).regime).toBe('underSaturated');
  });

  it('the point pass buys no energy for a duel that every stint already outlasts', () => {
    const duel = planFor(input, 'pvp', 60);
    expect(duel.pointResets.length).toBeGreaterThan(0);
    for (const reset of duel.pointResets) {
      expect(reset.pts.energy).toBe(0);
    }
    // The same roster on a rotation still finds energy worth buying, so the claim is the window's.
    const rotation = planFor(input, 'dps', 60);
    expect(rotation.pointResets.some((reset) => reset.pts.energy > 0)).toBe(true);
  });
});

describe('pvpSquadSlots', () => {
  it('is the reported slot count, or the top house’s when nothing usable was reported', () => {
    expect(pvpSquadSlots(2)).toBe(2);
    expect(pvpSquadSlots(6)).toBe(6);
    for (const unread of [null, undefined, 0, -1, 2.5, Number.NaN]) {
      expect(pvpSquadSlots(unread)).toBe(PVP_TOP_HOUSE_SQUAD_SLOTS);
    }
  });
});
