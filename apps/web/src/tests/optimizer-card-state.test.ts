import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanRunStatus } from '@bombfarm/team-plan/core';
import {
  optimizerCardState,
  type OptimizerCardStateInput,
} from '@/features/home/model/optimizer-card-state';

const PLAN = { currentDps: 100, planDps: 120 } as TeamPlan;
const RUN_STATUSES: readonly TeamPlanRunStatus[] = ['idle', 'running', 'done', 'blocked', 'error'];

const usable = (overrides: Partial<OptimizerCardStateInput>): OptimizerCardStateInput => ({
  inputsUsable: true,
  runStatus: 'done',
  plan: PLAN,
  stale: false,
  belowFloor: false,
  ...overrides,
});

describe('the optimizer card state', () => {
  it('picks one state per input combination', () => {
    const table: [OptimizerCardStateInput, ReturnType<typeof optimizerCardState>][] = [
      [usable({ inputsUsable: false, runStatus: 'idle', plan: null }), 'needs'],
      [usable({ inputsUsable: false, runStatus: 'running', plan: PLAN, stale: true }), 'needs'],
      [usable({ inputsUsable: false, runStatus: 'blocked', plan: null }), 'needs'],
      [usable({ inputsUsable: false, runStatus: 'error', plan: PLAN, belowFloor: true }), 'needs'],
      [usable({ inputsUsable: false, runStatus: 'done', plan: PLAN }), 'needs'],
      [usable({ runStatus: 'blocked', plan: null }), 'blocked'],
      [usable({ runStatus: 'blocked', plan: PLAN }), 'blocked'],
      [usable({ runStatus: 'error', plan: null }), 'error'],
      [usable({ runStatus: 'error', plan: PLAN }), 'error'],
      [usable({ runStatus: 'idle', plan: null }), 'skeleton'],
      [usable({ runStatus: 'running', plan: null }), 'skeleton'],
      [usable({ runStatus: 'running', plan: PLAN, stale: true }), 'recalculating'],
      [usable({ runStatus: 'done', plan: PLAN, stale: true }), 'recalculating'],
      [usable({ runStatus: 'done', plan: PLAN, stale: false, belowFloor: true }), 'belowFloor'],
      [usable({ runStatus: 'done', plan: PLAN, stale: false, belowFloor: false }), 'plan'],
    ];
    for (const [input, expected] of table) {
      expect(optimizerCardState(input), JSON.stringify(input)).toBe(expected);
    }
  });

  it('never renders the skeleton over an existing plan', () => {
    for (const runStatus of RUN_STATUSES) {
      for (const stale of [false, true]) {
        for (const belowFloor of [false, true]) {
          const input = usable({ runStatus, stale, belowFloor, plan: PLAN });
          expect(optimizerCardState(input), JSON.stringify(input)).not.toBe('skeleton');
        }
      }
    }
  });

  it('a stale plan recalculates whether or not it is under the floor', () => {
    const staleUnderFloor = { inputsUsable: true, plan: PLAN, stale: true, belowFloor: true } as const;
    expect(optimizerCardState({ ...staleUnderFloor, runStatus: 'running' })).toBe('recalculating');
    expect(optimizerCardState({ ...staleUnderFloor, runStatus: 'done' })).toBe('recalculating');
  });

  it('blocked and error win over an older plan', () => {
    expect(optimizerCardState(usable({ runStatus: 'blocked' }))).toBe('blocked');
    expect(optimizerCardState(usable({ runStatus: 'error' }))).toBe('error');
  });
});
