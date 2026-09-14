import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanRunStatus } from '@bombfarm/team-plan/core';
import {
  getLastRequestedSignature,
  noteSolveRequested,
  resetHomeSolveMemoryForTests,
  shouldRequestSolve,
  type SolveRequestInput,
} from '@/features/home/model/home-solve-request';

const PLAN = { currentDps: 100, planDps: 120 } as TeamPlan;
const RUN_STATUSES: readonly TeamPlanRunStatus[] = ['idle', 'running', 'done', 'blocked', 'error'];

const input = (overrides: Partial<SolveRequestInput>): SolveRequestInput => ({
  booted: true,
  inputsUsable: true,
  plan: null,
  runStatus: 'idle',
  stale: false,
  liveSignature: 'S1',
  lastRequestedSignature: getLastRequestedSignature(),
  ...overrides,
});

describe('the front page solve request', () => {
  beforeEach(() => {
    resetHomeSolveMemoryForTests();
  });

  it('requests once per signature and never while a run is in flight', () => {
    expect(getLastRequestedSignature()).toBeNull();
    expect(shouldRequestSolve(input({}))).toBe(true);
    expect(shouldRequestSolve(input({ runStatus: 'running' }))).toBe(false);
    expect(shouldRequestSolve(input({ runStatus: 'running', plan: PLAN, stale: true }))).toBe(false);

    noteSolveRequested('S1');
    expect(getLastRequestedSignature()).toBe('S1');
    expect(shouldRequestSolve(input({ runStatus: 'blocked' }))).toBe(false);
    expect(shouldRequestSolve(input({ runStatus: 'error' }))).toBe(false);
    expect(shouldRequestSolve(input({ plan: PLAN, stale: true, runStatus: 'done' }))).toBe(false);
  });

  it('does not request when a matching plan exists, when the inputs are unusable, or after blocked or error until the signature changes', () => {
    expect(shouldRequestSolve(input({ plan: PLAN, stale: false, runStatus: 'done' }))).toBe(false);
    for (const runStatus of RUN_STATUSES) {
      for (const plan of [null, PLAN]) {
        for (const stale of [false, true]) {
          for (const lastRequestedSignature of [null, 'S1', 'S2']) {
            const combination = { runStatus, plan, stale, lastRequestedSignature };
            expect(shouldRequestSolve(input({ ...combination, inputsUsable: false })), JSON.stringify(combination)).toBe(false);
            expect(shouldRequestSolve(input({ ...combination, booted: false })), JSON.stringify(combination)).toBe(false);
          }
        }
      }
    }
    for (const runStatus of ['blocked', 'error'] as const) {
      expect(shouldRequestSolve(input({ runStatus, lastRequestedSignature: 'S1', liveSignature: 'S1' }))).toBe(false);
      expect(shouldRequestSolve(input({ runStatus, lastRequestedSignature: 'S1', liveSignature: 'S2' }))).toBe(true);
    }
    expect(shouldRequestSolve(input({ plan: PLAN, stale: true, runStatus: 'done', lastRequestedSignature: 'S1', liveSignature: 'S1' }))).toBe(false);
    expect(shouldRequestSolve(input({ plan: PLAN, stale: true, runStatus: 'done', lastRequestedSignature: 'S1', liveSignature: 'S2' }))).toBe(true);
  });

  it('requests again after a cancelled run', () => {
    noteSolveRequested('S1');
    expect(shouldRequestSolve(input({ plan: null, runStatus: 'idle', liveSignature: 'S1' }))).toBe(true);
  });

  it("the effect asks the shell's solver and nothing else", () => {
    const source = readFileSync(
      resolve(__dirname, '../features/home/model/use-home-solve-request.ts'),
      'utf8',
    );
    expect(source).toContain('getTeamPlanSolver().solve()');
    expect(source).toContain('noteSolveRequested(');
    expect(source).toContain('shouldRequestSolve(');
    expect(source).not.toContain('@bombfarm/team-plan/runner');
    expect(source).not.toContain('createTeamPlanRunner');
    expect(source.match(/useEffect\(/g)).toHaveLength(1);
    const dependencies = /\}, \[([^\]]*)\]\);/.exec(source);
    expect(dependencies).not.toBeNull();
    const names = (dependencies?.[1] ?? '').split(',').map((name) => name.trim()).filter(Boolean);
    expect(names).toHaveLength(6);
    expect(new Set(names).size).toBe(6);
    expect(names).toEqual(['booted', 'inputsUsable', 'plan', 'runStatus', 'stale', 'liveSignature']);
    expect(source.match(/usePlannerStore\(/g)).toHaveLength(6);
  });
});
