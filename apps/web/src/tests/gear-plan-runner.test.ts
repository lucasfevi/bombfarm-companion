import { describe, expect, it } from 'vitest';
import { runGearPlan } from '@bombfarm/domain/gear-plan';
import type { GearPlan, GearPlanInput } from '@bombfarm/domain/gear-plan/types';
import {
  createGearPlanRunner,
  type GearPlanWorkerLike,
} from '@/features/gear-plan/hooks/use-gear-plan-runner';
import type { GearPlanWorkerResponse } from '@/features/gear-plan/worker/gear-plan.worker';
import { gearPlanInputFromFixture } from './helpers/gear-plan-fixture';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneInput(input: GearPlanInput): GearPlanInput {
  return cloneJson(input);
}

function asWorkerMessage(data: GearPlanWorkerResponse): MessageEvent<GearPlanWorkerResponse> {
  return { data } as unknown as MessageEvent<GearPlanWorkerResponse>;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createRespondingWorker(
  handler: (input: GearPlanInput) => GearPlanWorkerResponse,
): () => GearPlanWorkerLike {
  return () => {
    const worker: GearPlanWorkerLike = {
      onmessage: null,
      onerror: null,
      terminate() {},
      postMessage(message) {
        const response = handler(message.input);
        queueMicrotask(() => {
          worker.onmessage?.(asWorkerMessage({ ...response, runId: message.runId }));
        });
      },
    };
    return worker;
  };
}

describe('createGearPlanRunner', () => {
  it('drops stale worker responses when a newer run supersedes', async () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const lateReplyBox: { fn: ((runId: string) => void) | null } = { fn: null };
    const factory = () => {
      const worker: GearPlanWorkerLike = {
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage(message) {
          if (message.runId === '1') {
            lateReplyBox.fn = (runId: string) => {
              worker.onmessage?.(
                asWorkerMessage({
                  kind: 'done',
                  runId,
                  result: {
                    blocked: false,
                    plan: { planDps: 1, currentDps: 0 } as unknown as GearPlan,
                  },
                }),
              );
            };
            return;
          }
          // Avoid a full solver pass — supersession only needs a distinct planDps.
          queueMicrotask(() => {
            worker.onmessage?.(
              asWorkerMessage({
                kind: 'done',
                runId: message.runId,
                result: {
                  blocked: false,
                  plan: { planDps: 42, currentDps: 0 } as unknown as GearPlan,
                },
              }),
            );
          });
        },
      };
      return worker;
    };

    const runner = createGearPlanRunner({ createWorker: factory });
    runner.run(cloneInput(input));
    runner.run(cloneInput(input));
    await flushMicrotasks();
    expect(runner.runId).toBe('2');
    expect(runner.status).toBe('done');
    expect(runner.plan?.planDps).toBe(42);
    lateReplyBox.fn?.('1');
    await flushMicrotasks();
    expect(runner.runId).toBe('2');
    expect(runner.plan?.planDps).toBe(42);
  });

  it('falls back to main thread when worker construction throws', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const runner = createGearPlanRunner({
      createWorker: () => {
        throw new Error('no worker');
      },
    });
    runner.run(cloneInput(input));
    expect(runner.ranOnMainThread).toBe(true);
    expect(runner.status).toBe('done');
    expect(runner.plan).not.toBeNull();
  });

  it('falls back to main thread when worker emits error', async () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const runner = createGearPlanRunner({
      createWorker: () => ({
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage() {
          queueMicrotask(() => {
            this.onerror?.({} as ErrorEvent);
          });
        },
      }),
    });
    runner.run(cloneInput(input));
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(runner.ranOnMainThread).toBe(true);
    expect(runner.status).toBe('done');
    expect(runner.plan).not.toBeNull();
  });

  it('surfaces blocked results with hero names and no plan', async () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const firstHero = input.heroes[0];
    if (!firstHero) throw new Error('fixture must include at least one hero');
    input.heroes[0] = { ...firstHero, birth: undefined };
    const runner = createGearPlanRunner({
      createWorker: createRespondingWorker(() => ({
        kind: 'blocked',
        runId: 'ignored',
        heroNames: ['Blocked Hero'],
      })),
    });
    runner.run(cloneInput(input));
    await flushMicrotasks();
    expect(runner.status).toBe('blocked');
    expect(runner.blockedHeroNames).toEqual(['Blocked Hero']);
    expect(runner.plan).toBeNull();
  });

  it('round-trips GearPlanInput and GearPlan through JSON clone', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const clonedInput = cloneInput(input);
    expect(clonedInput.heroes).toHaveLength(input.heroes.length);
    expect(clonedInput.inventory).toHaveLength(input.inventory.length);
    const result = runGearPlan(clonedInput);
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      const clonedPlan = cloneJson(result.plan);
      expect(clonedPlan.planDps).toBe(result.plan.planDps);
      expect(clonedPlan.currentDps).toBe(result.plan.currentDps);
    }
  });

  it('terminates the previous worker when starting a new run', () => {
    let terminateCount = 0;
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const runner = createGearPlanRunner({
      createWorker: () => ({
        onmessage: null,
        onerror: null,
        terminate() {
          terminateCount += 1;
        },
        postMessage() {},
      }),
    });
    runner.run(cloneInput(input));
    runner.run(cloneInput(input));
    expect(terminateCount).toBeGreaterThanOrEqual(1);
  });

  it('maps worker done responses to plan state', async () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const expected = runGearPlan(input);
    const runner = createGearPlanRunner({
      createWorker: createRespondingWorker(() =>
        expected.blocked
          ? { kind: 'blocked', runId: 'x', heroNames: expected.heroNames }
          : { kind: 'done', runId: 'x', result: expected },
      ),
    });
    runner.run(cloneInput(input));
    await flushMicrotasks();
    expect(runner.status).toBe('done');
    expect(runner.plan?.planDps).toBe(expected.blocked ? undefined : expected.plan.planDps);
  });

  it('maps worker error responses to error status', async () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const runner = createGearPlanRunner({
      createWorker: createRespondingWorker(() => ({
        kind: 'error',
        runId: 'x',
        message: 'boom',
      })),
    });
    runner.run(cloneInput(input));
    await flushMicrotasks();
    expect(runner.status).toBe('error');
    expect(runner.errorMessage).toBe('boom');
    expect(runner.plan).toBeNull();
  });

  it('cancel resets to idle without a plan', () => {
    const runner = createGearPlanRunner({
      createWorker: () => ({
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage() {},
      }),
    });
    runner.run(cloneInput(gearPlanInputFromFixture('save-20260731-11heroes.json')));
    runner.cancel();
    expect(runner.status).toBe('idle');
    expect(runner.plan).toBeNull();
  });

  it('sets running status before the worker responds', () => {
    const runner = createGearPlanRunner({
      createWorker: () => ({
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage() {},
      }),
    });
    runner.run(cloneInput(gearPlanInputFromFixture('save-20260731-11heroes.json')));
    expect(runner.status).toBe('running');
  });

  it('keeps ranOnMainThread false for successful worker runs', async () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const result = runGearPlan(input);
    const runner = createGearPlanRunner({
      createWorker: createRespondingWorker(() =>
        result.blocked
          ? { kind: 'blocked', runId: 'x', heroNames: result.heroNames }
          : { kind: 'done', runId: 'x', result },
      ),
    });
    runner.run(cloneInput(input));
    await flushMicrotasks();
    expect(runner.ranOnMainThread).toBe(false);
  });

  it('serializes nested inventory items without losing fields', () => {
    const input = gearPlanInputFromFixture('save-20260731-11heroes.json');
    const json = JSON.stringify(input);
    const parsed = JSON.parse(json) as GearPlanInput;
    expect(parsed.inventory[0]?.id).toBe(input.inventory[0]?.id);
    expect(parsed.heroes[0]?.heroId).toBe(input.heroes[0]?.heroId);
    expect(parsed.heroes[0]?.pts.attack).toBe(input.heroes[0]?.pts.attack);
  });
});
