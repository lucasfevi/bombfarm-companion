import { describe, expect, it } from 'vitest';
import { createLogSink } from '../premium-test-support.js';
import type { CapabilityChannel } from './capability-channel.js';
import { createFakeFork } from './host-fakes.js';
import { createWorkerSupervisor, type WorkerSupervisorDeps } from './worker-supervisor.js';

function rig(extra: Partial<WorkerSupervisorDeps> = {}) {
  const fakes = createFakeFork();
  const seen: (CapabilityChannel | null)[] = [];
  const supervisor = createWorkerSupervisor({
    fork: fakes.fork,
    createChannel: fakes.createChannel,
    loaderPath: 'premium-worker.cjs',
    vars: {},
    allowlist: new Map([['x', () => 1]]),
    onChannel: (channel) => seen.push(channel),
    now: () => 0,
    log: createLogSink(),
    ...extra,
  });
  return { fakes, seen, supervisor };
}

const bundle = (sequence = 4) => ({ sequence, version: '1.0.0', workerBytes: new Uint8Array(), requested: ['x'] });
const call = (fakes: ReturnType<typeof createFakeFork>, index: number, id: number): void => {
  fakes.channels[index]?.port1.deliver({ id, capability: 'x', args: null });
};
const replies = (fakes: ReturnType<typeof createFakeFork>, index: number): { id: number; ok: boolean; error?: string }[] =>
  (fakes.channels[index]?.port1.sent ?? []).filter((m) => 'ok' in (m as object)) as { id: number; ok: boolean; error?: string }[];

describe('the channel a supervised worker gets', () => {
  it('is announced when the worker starts and withdrawn when it stops', () => {
    const { supervisor, seen } = rig();

    supervisor.start(bundle());
    expect(seen).toHaveLength(1);
    expect(seen[0]?.granted).toEqual(['x']);

    supervisor.stop();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBeNull();
  });

  it('is withdrawn before the next one is announced when a worker is replaced', () => {
    const { supervisor, seen } = rig();

    supervisor.start(bundle(4));
    supervisor.start(bundle(5));

    expect(seen.map((channel) => channel === null)).toEqual([false, true, false]);
    expect(seen[0]).not.toBe(seen[2]);
  });

  it('is withdrawn when the worker exits on its own', () => {
    const { supervisor, seen, fakes } = rig();

    supervisor.start(bundle());
    fakes.forks[0]?.child.exit(1);

    expect(seen.map((channel) => channel === null)).toEqual([false, true]);
  });

  it('still starts and stops the worker when the watcher throws', () => {
    const { supervisor, fakes } = rig({
      onChannel: () => {
        throw new Error('watcher fault');
      },
    });

    supervisor.start(bundle());
    expect(fakes.forks).toHaveLength(1);
    supervisor.stop();
    expect(fakes.forks[0]?.child.killed).toBe(1);
  });
});

describe('the budgets a supervised worker gets', () => {
  it('are the ones the supervisor was given', () => {
    const { supervisor, fakes } = rig({ budgets: { x: { perMinute: 1 } } });
    supervisor.start(bundle());

    call(fakes, 0, 1);
    call(fakes, 0, 2);

    expect(replies(fakes, 0).map((reply) => reply.error ?? 'ok')).toEqual(['ok', 'rate_limited']);
  });

  it('leave the channel defaults alone when none are given', () => {
    const { supervisor, fakes } = rig();
    supervisor.start(bundle());

    for (let id = 1; id <= 61; id += 1) call(fakes, 0, id);

    const answers = replies(fakes, 0).map((reply) => reply.error ?? 'ok');
    expect(answers.filter((answer) => answer === 'ok')).toHaveLength(60);
    expect(answers.at(-1)).toBe('rate_limited');
  });
});
