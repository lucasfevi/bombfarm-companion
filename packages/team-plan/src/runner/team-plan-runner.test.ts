import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { treeTotalsFromSave } from '@bombfarm/domain/save-units';
import type { TeamPlan, TeamPlanHeroInput, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { createTeamPlanRunner, type TeamPlanWorkerLike } from './use-team-plan-runner';
import type { TeamPlanWorkerResponse } from './team-plan.worker';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../domain/tests/fixtures/sheet-math',
);

function loadFixtureJson(filename: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, filename), 'utf8')) as Record<string, unknown>;
}

function teamPlanInputFromFixture(file: string, forgeFloor = 10): TeamPlanInput {
  const raw = loadFixtureJson(file);
  const { inventory, candidates, account } = parseSaveFile(raw, []);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const treeSheet = treeTotalsFromSave(totals);
  const heroes: TeamPlanHeroInput[] = candidates
    .filter((c) => !c.blocked)
    .map((c) => ({
      heroId: c.sourceId,
      name: c.name,
      level: c.level,
      stars: c.record.stars,
      rarity: c.rarity,
      birth: c.record.birth,
      abilities: c.record.abilities,
      pts: c.record.pts,
      loadout: c.record.loadout,
      battleAllowed: c.record.battleAllowed,
      statPointsAvailable: c.record.statPointsAvailable,
    }));
  const scopeByHeroId = Object.fromEntries(heroes.map((h) => [h.heroId, 'optimize' as const]));
  return {
    heroes,
    inventory,
    account: {
      treeSheet,
      houseIdx: account.houseIdx ?? 0,
      houseLevel: account.houseLevel ?? 1,
      phase: 1,
      mitigationPct: 6.7,
      slots: account.slots ?? 9,
      fieldSlots: account.fieldSlots ?? account.slots ?? 9,
    },
    scopeByHeroId,
    forgeFloor,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneInput(input: TeamPlanInput): TeamPlanInput {
  return cloneJson(input);
}

function asWorkerMessage(data: TeamPlanWorkerResponse): MessageEvent<TeamPlanWorkerResponse> {
  return { data } as unknown as MessageEvent<TeamPlanWorkerResponse>;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createRespondingWorker(
  handler: (input: TeamPlanInput) => TeamPlanWorkerResponse,
): () => TeamPlanWorkerLike {
  return () => {
    const worker: TeamPlanWorkerLike = {
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

// Class (b) — structural: re-pointed onto payload-20260812-8heroes.json. Every
// assertion here is about the runner's worker-message plumbing (status transitions, JSON
// round-trip, supersession) — none pins a captured value.
describe('createTeamPlanRunner', () => {
  it('drops stale worker responses when a newer run supersedes', async () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const lateReplyBox: { fn: ((runId: string) => void) | null } = { fn: null };
    const factory = () => {
      const worker: TeamPlanWorkerLike = {
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
                    plan: { planDps: 1, currentDps: 0 } as unknown as TeamPlan,
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
                  plan: { planDps: 42, currentDps: 0 } as unknown as TeamPlan,
                },
              }),
            );
          });
        },
      };
      return worker;
    };

    const runner = createTeamPlanRunner({ createWorker: factory });
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
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const runner = createTeamPlanRunner({
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
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const runner = createTeamPlanRunner({
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
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const firstHero = input.heroes[0];
    if (!firstHero) throw new Error('fixture must include at least one hero');
    input.heroes[0] = { ...firstHero, birth: undefined };
    const runner = createTeamPlanRunner({
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

  it('round-trips TeamPlanInput and TeamPlan through JSON clone', () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const clonedInput = cloneInput(input);
    expect(clonedInput.heroes).toHaveLength(input.heroes.length);
    expect(clonedInput.inventory).toHaveLength(input.inventory.length);
    const result = runTeamPlan(clonedInput);
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      const clonedPlan = cloneJson(result.plan);
      expect(clonedPlan.planDps).toBe(result.plan.planDps);
      expect(clonedPlan.currentDps).toBe(result.plan.currentDps);
    }
  });

  it('terminates the previous worker when starting a new run', () => {
    let terminateCount = 0;
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const runner = createTeamPlanRunner({
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
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const expected = runTeamPlan(input);
    const runner = createTeamPlanRunner({
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
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const runner = createTeamPlanRunner({
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
    const runner = createTeamPlanRunner({
      createWorker: () => ({
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage() {},
      }),
    });
    runner.run(cloneInput(teamPlanInputFromFixture('payload-20260812-8heroes.json')));
    runner.cancel();
    expect(runner.status).toBe('idle');
    expect(runner.plan).toBeNull();
  });

  it('sets running status before the worker responds', () => {
    const runner = createTeamPlanRunner({
      createWorker: () => ({
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage() {},
      }),
    });
    runner.run(cloneInput(teamPlanInputFromFixture('payload-20260812-8heroes.json')));
    expect(runner.status).toBe('running');
  });

  it('keeps ranOnMainThread false for successful worker runs', async () => {
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const result = runTeamPlan(input);
    const runner = createTeamPlanRunner({
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
    const input = teamPlanInputFromFixture('payload-20260812-8heroes.json');
    const json = JSON.stringify(input);
    const parsed = JSON.parse(json) as TeamPlanInput;
    expect(parsed.inventory[0]?.id).toBe(input.inventory[0]?.id);
    expect(parsed.heroes[0]?.heroId).toBe(input.heroes[0]?.heroId);
    expect(parsed.heroes[0]?.pts.attack).toBe(input.heroes[0]?.pts.attack);
  });
});
