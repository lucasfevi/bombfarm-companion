import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { buildTeamPlanInput } from '@bombfarm/team-plan/core';
import {
  createTeamPlanRunner,
  type TeamPlanWorkerLike,
  type TeamPlanWorkerRequest,
  type TeamPlanWorkerResponse,
} from '@bombfarm/team-plan/runner';
import { createShellTeamPlanSolver } from '@/app/_shell/create-shell-team-plan-solver';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import {
  selectTeamPlanControls,
  selectTeamPlanInputs,
} from '@/shared/stores/selectors/team-plan-selectors';
import {
  ensureTeamPlanSolver,
  getTeamPlanSolver,
  resetTeamPlanSolverForTests,
  type TeamPlanSolver,
} from '@/shared/stores/team-plan-solver';

vi.mock('@bombfarm/team-plan/runner', async (importOriginal) => {
  const real = await importOriginal<typeof import('@bombfarm/team-plan/runner')>();
  return { ...real, createTeamPlanRunner: vi.fn(real.createTeamPlanRunner) };
});

const webRoot = resolve(__dirname, '..');
const source = (file: string) => readFileSync(resolve(webRoot, file), 'utf8');

function stubSolver(): TeamPlanSolver {
  return {
    getSnapshot: () => ({
      status: 'idle',
      plan: null,
      blockedHeroNames: [],
      errorMessage: null,
      ranOnMainThread: false,
      runId: null,
    }),
    subscribe: () => () => {},
    solve: () => {},
    cancel: () => {},
    runner: {} as TeamPlanSolver['runner'],
  };
}

function samplePlan(): TeamPlan {
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
    planDps: 120,
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

function recordingWorkerFactory(posted: TeamPlanWorkerRequest[]) {
  return (): TeamPlanWorkerLike => {
    const worker: TeamPlanWorkerLike = {
      onmessage: null,
      onerror: null,
      terminate() {},
      postMessage(message) {
        posted.push(message);
        queueMicrotask(() => {
          worker.onmessage?.(
            asWorkerMessage({
              kind: 'done',
              runId: message.runId,
              result: { blocked: false, plan: samplePlan() },
            }),
          );
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

function hero(index: number) {
  return normalizeHero({
    id: `h${index}`,
    name: `Hero ${index}`,
    sourceId: `src-${index}`,
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
}

function bootThirteenHeroStore() {
  const heroes = Array.from({ length: 13 }, (_, index) => hero(index + 1));
  usePlannerStore.getState().hydrateRoster(heroes, heroes[0].id);
  usePlannerStore.setState({
    inventory: { version: 1, importedAt: 1, items: [item] },
    scopeByHeroId: Object.fromEntries(heroes.map((h) => [h.id, 'optimize' as const])),
    objective: 'farm',
    phase: 51,
    maxPhase: 137,
  });
}

describe('the shared optimizer solver port', () => {
  afterEach(() => {
    resetTeamPlanSolverForTests();
  });

  it('the latch creates one solver however many times it is asked', () => {
    const create = vi.fn(stubSolver);

    const first = ensureTeamPlanSolver(create);
    const second = ensureTeamPlanSolver(create);
    const third = ensureTeamPlanSolver(create);

    expect(create).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(getTeamPlanSolver()).toBe(first);
  });

  it('reading before the shell installed it throws, naming the installer', () => {
    resetTeamPlanSolverForTests();

    expect(() => getTeamPlanSolver()).toThrow(/ClientMountGate/);
  });
});

describe('the solver the shell composes', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetTeamPlanSolverForTests();
    vi.mocked(createTeamPlanRunner).mockClear();
  });

  afterEach(() => {
    resetTeamPlanSolverForTests();
    resetPlannerStoreForTests();
  });

  it("the shell creates one runner for the whole session however many times the gate's effect runs", () => {
    const first = ensureTeamPlanSolver(createShellTeamPlanSolver);
    const second = ensureTeamPlanSolver(createShellTeamPlanSolver);

    expect(vi.mocked(createTeamPlanRunner)).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(second.runner).toBe(first.runner);
  });

  it("the solver builds the run's input from the live store", () => {
    bootThirteenHeroStore();
    const posted: TeamPlanWorkerRequest[] = [];
    const solver = createShellTeamPlanSolver({ createWorker: recordingWorkerFactory(posted) });

    solver.solve();

    const state = usePlannerStore.getState();
    expect(posted).toHaveLength(1);
    const request = posted[0];
    expect(request.input.heroes).toHaveLength(13);
    expect(request.input.heroes.map((h) => h.heroId)).toEqual(
      state.heroes.map((h) => h.sourceId),
    );
    expect(request.input).toEqual(
      buildTeamPlanInput(selectTeamPlanInputs(state), selectTeamPlanControls(state)),
    );
    expect(request.input.objective).toBe('farm');
    expect(request.input.forgeFloor).toBe(state.forgeFloor);
  });

  it('the composed solver satisfies the port at runtime and its snapshot is stable between changes', () => {
    bootThirteenHeroStore();
    const solver = createShellTeamPlanSolver({ createWorker: recordingWorkerFactory([]) });

    expect(typeof solver.getSnapshot).toBe('function');
    expect(typeof solver.subscribe).toBe('function');
    expect(typeof solver.solve).toBe('function');
    expect(typeof solver.cancel).toBe('function');
    expect(typeof solver.runner.run).toBe('function');
    expect(typeof solver.runner.subscribe).toBe('function');

    const idle = solver.getSnapshot();
    expect(solver.getSnapshot()).toBe(idle);
    expect(idle).toEqual({
      status: 'idle',
      plan: null,
      blockedHeroNames: [],
      errorMessage: null,
      ranOnMainThread: false,
      runId: null,
    });

    solver.solve();

    const running = solver.getSnapshot();
    expect(running).not.toBe(idle);
    expect(solver.getSnapshot()).toBe(running);
    expect(running.status).toBe('running');
    expect(typeof running.runId).toBe('string');
    expect(running).toEqual({
      status: solver.runner.status,
      plan: solver.runner.plan,
      blockedHeroNames: solver.runner.blockedHeroNames,
      errorMessage: solver.runner.errorMessage,
      ranOnMainThread: solver.runner.ranOnMainThread,
      runId: solver.runner.runId,
    });
  });

  it('the gate installs the shell solver, the shell no longer pins the worker factory, and the page reads the runner', () => {
    const gate = source('app/_shell/client-mount-gate.tsx');
    expect(gate).toMatch(/\bensureTeamPlanSolver\b/);
    expect(gate).toMatch(/\bcreateShellTeamPlanSolver\b/);
    expect(gate).toMatch(/ensureTeamPlanSolver\(createShellTeamPlanSolver\)/);

    const shell = source('app/_shell/client-app-shell.tsx');
    expect(shell).not.toContain('workerFactoryRef');
    expect(shell).not.toContain('createTeamPlanWorkerModule');

    const page = source('features/team-plan/components/team-plan-page.tsx');
    expect(page).toMatch(/\buseTeamPlanSolver\b/);
    expect(page).toContain('runner={runner}');
  });
});
