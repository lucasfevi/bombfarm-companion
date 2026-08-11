import { describe, expect, it, vi } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import type { PointAlloc } from '@bombfarm/domain/gear/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { AssignmentState } from '@bombfarm/domain/team-plan/solver-assignment';
import type {
  EvaluateRosterInput,
  TeamPlanInput,
  HeroPlanContext,
  RosterEvaluation,
} from '@bombfarm/domain/team-plan/types';
import { buildWaterfall } from '@bombfarm/domain/team-plan/waterfall';

/**
 * `requiresFullPlan` / `gearDipDps` (option B: the gear step MAY dip below today, disclosed
 * rather than discarded — see waterfall-guards.ts) is never actually exercised by the committed
 * save fixtures: a full grid sweep (both fixtures × every forge floor × every slot count, plus
 * donate-scope mixes) never produced a dipping winner, because the guarded, converged search
 * (solver-search.ts) rarely if ever hands `chooseGearCandidate` a `planAssignment` that scores
 * below today at `currentPts`. That is a property of today's fixtures, not a guarantee of the
 * code path, so this file exercises the branch directly with a mocked `evaluateRoster` — the
 * cheapest way to force a real dip-then-recover scenario deterministically.
 */
vi.mock('@bombfarm/domain/team-plan/evaluate', () => ({
  evaluateRoster: vi.fn((input: EvaluateRosterInput): RosterEvaluation => {
    const isPlanAssignment = input.loadoutsByHeroId.hero1?.arma?.defId === 'sword_def';
    const isFinalPts = input.ptsByHeroId.hero1?.attack === 100;
    // Baseline assignment always scores 1000, regardless of points — mirrors "hero's final
    // points don't help until the gear is actually equipped".
    // Plan assignment: 900 pre-resets (a real 100-point dip below today) but 1200 once the
    // resets land — the dip pays off, which is exactly what option B is meant to allow.
    const objective = !isPlanAssignment ? 1000 : isFinalPts ? 1200 : 900;
    return {
      objective,
      regime: 'underSaturated',
      sumDuty: 0,
      slots: input.slots,
      perHero: {},
      auras: {} as RosterEvaluation['auras'],
    };
  }),
}));

function pts(attack: number): PointAlloc {
  return { attack, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };
}

function emptySlots(): Record<string, string | null> {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null]));
}

describe('buildWaterfall requiresFullPlan / gearDipDps (mocked evaluateRoster)', () => {
  it('discloses a transient gear-step dip that the respec recovers past today', () => {
    const currentPts: Record<string, PointAlloc> = { hero1: pts(0) };
    const finalPtsByHeroId: Record<string, PointAlloc> = { hero1: pts(100) };

    const baselineAssignment: AssignmentState = { slots: { hero1: emptySlots() }, pool: new Set() };
    const planAssignment: AssignmentState = {
      slots: { hero1: { ...emptySlots(), arma: 'sword' } },
      pool: new Set(),
    };

    const itemById = new Map<string, InventoryItem>([
      [
        'sword',
        {
          id: 'sword',
          defId: 'sword_def',
          rarityIdx: 0,
          level: 1,
          upgrade: 0,
          slot: 'arma',
          equipped: true,
          equippedBy: 'hero1',
          defResolved: true,
          marketBlocked: false,
        },
      ],
    ]);

    const contexts = [
      { heroId: 'hero1', name: 'Hero One', level: 50, scope: 'optimize', pts: currentPts.hero1 },
    ] as unknown as HeroPlanContext[];

    const gearInput = {
      heroes: [{ heroId: 'hero1', name: 'Hero One', level: 50, pts: currentPts.hero1 }],
      inventory: [],
      account: { slots: 1 },
      scopeByHeroId: { hero1: 'optimize' },
      forgeFloor: 0,
    } as unknown as TeamPlanInput;

    const result = buildWaterfall({
      gearInput,
      contexts,
      currentAssignment: baselineAssignment,
      planAssignment,
      finalPtsByHeroId,
      itemById,
    });

    const today = result.steps.find((s) => s.id === 'today')!;
    const gear = result.steps.find((s) => s.id === 'gear')!;
    const respec = result.steps.find((s) => s.id === 'respec')!;

    expect(today.objective).toBeCloseTo(1000, 6);
    expect(gear.objective).toBeCloseTo(900, 6);
    expect(respec.objective).toBeCloseTo(1200, 6);

    // The dip is real and correctly flagged — not a false positive.
    expect(result.requiresFullPlan).toBe(true);
    expect(gear.delta).toBeLessThan(-1e-9);
    expect(result.gearDipDps).toBeCloseTo(100, 6);
    expect(result.gearDipDps).toBeCloseTo(today.objective - gear.objective, 6);

    // The two guarantees that must hold regardless of the dip.
    expect(respec.delta).toBeGreaterThanOrEqual(-1e-9);
    expect(respec.objective).toBeGreaterThanOrEqual(today.objective - 1e-9);

    // The reset that bought the recovery is disclosed with its display-only cost.
    expect(result.pointResets).toHaveLength(1);
    expect(result.pointResets[0]).toMatchObject({ heroId: 'hero1', resetCostGold: 50_000 });
    expect(result.pointResets[0]!.rosterGainDps).toBeCloseTo(300, 6);
  });

  it('does not flag requiresFullPlan when the gear step never dips', () => {
    const currentPts: Record<string, PointAlloc> = { hero1: pts(0) };
    const baselineAssignment: AssignmentState = { slots: { hero1: emptySlots() }, pool: new Set() };

    const contexts = [
      { heroId: 'hero1', name: 'Hero One', level: 50, scope: 'optimize', pts: currentPts.hero1 },
    ] as unknown as HeroPlanContext[];

    const gearInput = {
      heroes: [{ heroId: 'hero1', name: 'Hero One', level: 50, pts: currentPts.hero1 }],
      inventory: [],
      account: { slots: 1 },
      scopeByHeroId: { hero1: 'optimize' },
      forgeFloor: 0,
    } as unknown as TeamPlanInput;

    // Baseline vs baseline: no moves proposed, so the gear step can only equal today.
    const result = buildWaterfall({
      gearInput,
      contexts,
      currentAssignment: baselineAssignment,
      planAssignment: baselineAssignment,
      finalPtsByHeroId: currentPts,
      itemById: new Map(),
    });

    expect(result.requiresFullPlan).toBe(false);
    expect(result.gearDipDps).toBe(0);
  });
});
