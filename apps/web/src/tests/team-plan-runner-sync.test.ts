import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanWorkerLike, TeamPlanWorkerResponse } from '@bombfarm/team-plan/runner';
import { createShellTeamPlanSolver } from '@/app/_shell/create-shell-team-plan-solver';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { attachTeamPlanRunnerSync } from '@/shared/stores/team-plan-runner-sync';

function samplePlan(planDps: number): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 1,
    slots: 3,
    currentDps: 100,
    planDps,
    forgeFloorApplied: 10,
    allowedChanges: 'both',
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 1, evaluations: 1, budgetExhausted: false, elapsedMs: 1, seedUsed: 'seed' },
  };
}

function asWorkerMessage(data: TeamPlanWorkerResponse): MessageEvent<TeamPlanWorkerResponse> {
  return { data } as unknown as MessageEvent<TeamPlanWorkerResponse>;
}

type PendingReply = { runId: string; answer: (plan: TeamPlan) => void };

function heldWorkerFactory(pending: PendingReply[]) {
  return (): TeamPlanWorkerLike => {
    const worker: TeamPlanWorkerLike = {
      onmessage: null,
      onerror: null,
      terminate() {},
      postMessage(message) {
        pending.push({
          runId: message.runId,
          answer: (plan) => {
            worker.onmessage?.(
              asWorkerMessage({
                kind: 'done',
                runId: message.runId,
                result: { blocked: false, plan },
              }),
            );
          },
        });
      },
    };
    return worker;
  };
}

const item: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

const stats = {
  attack: 100,
  energy: 100,
  speed: 50,
  critChance: 0,
  critDmg: 10,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

const hero = normalizeHero({
  id: 'a',
  name: 'Hero a',
  sourceId: 'src-a',
  updatedAt: 1,
  rarity: 'Raro',
  level: 10,
  stars: 1,
  naked: { ...stats },
  gearedOverride: { ...stats },
  loadout: emptyLoadout(),
  pts: ZERO_PTS(),
  battleAllowed: true,
});

function bootUsableStore() {
  usePlannerStore.getState().hydrateRoster([hero], 'a');
  usePlannerStore.setState({
    inventory: { version: 1, importedAt: 1, items: [item] },
    scopeByHeroId: { a: 'optimize' },
    objective: 'farm',
    phase: 51,
    maxPhase: 137,
  });
}

const state = () => usePlannerStore.getState();

describe('the shell-level runner-to-store sync', () => {
  let pending: PendingReply[];
  let detach: () => void;
  let solver: ReturnType<typeof createShellTeamPlanSolver>;

  beforeEach(() => {
    resetPlannerStoreForTests();
    bootUsableStore();
    pending = [];
    solver = createShellTeamPlanSolver({ createWorker: heldWorkerFactory(pending) });
    detach = attachTeamPlanRunnerSync(usePlannerStore, solver);
  });

  afterEach(() => {
    detach();
    resetPlannerStoreForTests();
  });

  it('a run that finishes while no page is mounted still lands in the store', () => {
    const plan = samplePlan(120);

    solver.solve();
    const runId = solver.getSnapshot().runId;
    expect(state().runStatus).toBe('running');
    expect(state().runId).toBe(runId);

    pending[0].answer(plan);

    expect(state().plan).toEqual(plan);
    expect(state().runStatus).toBe('done');
    expect(state().runId).toBe(runId);
    expect(solver.getSnapshot().runId).toBe(runId);
  });

  it('a result whose run the store has since disowned never becomes the plan', () => {
    solver.solve();
    state().clearPlan();
    expect(state().runId).toBeNull();

    pending[0].answer(samplePlan(120));

    expect(state().plan).toBeNull();
    expect(state().runStatus).toBe('idle');
  });

  it("a superseded run's result never reaches the store", () => {
    const firstPlan = samplePlan(111);
    const secondPlan = samplePlan(222);

    solver.solve();
    const firstRunId = solver.getSnapshot().runId;
    solver.solve();
    const secondRunId = solver.getSnapshot().runId;
    expect(secondRunId).not.toBe(firstRunId);
    expect(pending.map((reply) => reply.runId)).toEqual([firstRunId, secondRunId]);

    pending[1].answer(secondPlan);
    pending[0].answer(firstPlan);

    expect(state().runId).toBe(secondRunId);
    expect(state().plan).toEqual(secondPlan);
    expect(state().plan).not.toEqual(firstPlan);
    expect(state().runStatus).toBe('done');
  });

  it("the page's own dispatch of the same run after the shell's is a no-op", () => {
    solver.solve();
    pending[0].answer(samplePlan(120));
    const runId = state().runId ?? '';
    const landedPlan = state().plan ?? samplePlan(0);
    expect(runId).not.toBe('');
    expect(landedPlan.planDps).toBe(120);

    state().startRun(runId);
    state().applyPlan(runId, landedPlan);
    state().resolveRun(runId, 'done');
    state().applyPlan(runId, landedPlan);

    expect(state().plan).toBe(landedPlan);
    expect(state().runId).toBe(runId);
    expect(state().runStatus).toBe('done');
  });
});
