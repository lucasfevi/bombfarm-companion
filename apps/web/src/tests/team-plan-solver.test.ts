import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensureTeamPlanSolver,
  getTeamPlanSolver,
  resetTeamPlanSolverForTests,
  type TeamPlanSolver,
} from '@/shared/stores/team-plan-solver';

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
