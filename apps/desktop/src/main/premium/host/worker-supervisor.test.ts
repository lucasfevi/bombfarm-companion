import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLogSink } from '../premium-test-support.js';
import { createFakeFork, FakeChild, pair, type FakePair, type ForkRecord } from './host-fakes.js';
import { createWorkerSupervisor, workerEnv } from './worker-supervisor.js';

const VARS = {
  SYSTEMROOT: 'C:\\Windows',
  TEMP: 'C:\\Temp',
  TMP: 'C:\\Temp',
  BFC_PREMIUM_API_ORIGIN: 'http://127.0.0.1:1',
  SESSION_TOKEN: 'token-shaped-value',
  PATH: 'C:\\somewhere',
};

function rig(options: { loader?: boolean } = {}): {
  forks: ForkRecord[];
  channels: FakePair[];
  supervisor: ReturnType<typeof createWorkerSupervisor>;
  log: ReturnType<typeof createLogSink>;
  exits: boolean[];
  exitCodes: number[];
} {
  const fakes = createFakeFork(options);
  const log = createLogSink();
  const supervisor = createWorkerSupervisor({
    fork: fakes.fork,
    createChannel: fakes.createChannel,
    loaderPath: '/app/dist/main/premium-worker.cjs',
    vars: VARS,
    allowlist: new Map(),
    now: () => 0,
    log,
  });
  const exits: boolean[] = [];
  supervisor.onExit((requested) => exits.push(requested));
  return { forks: fakes.forks, channels: fakes.channels, supervisor, log, exits, exitCodes: fakes.exitCodes };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
};

const FIXTURE_WORKER = readFileSync(join(__dirname, '../../../../tests/fixtures/premium/bundle/worker/index.cjs'));

function bundle(code: Uint8Array = FIXTURE_WORKER, requested: string[] = []) {
  return { sequence: 4, version: '1.0.0', workerBytes: new Uint8Array(code), requested };
}

describe('the process the supervisor forks', () => {
  it('passes exactly the fixed options and a three-variable environment', () => {
    const { supervisor, forks } = rig();
    supervisor.start(bundle());
    expect(forks).toHaveLength(1);
    expect(forks[0]?.modulePath).toBe('/app/dist/main/premium-worker.cjs');
    expect(forks[0]?.args).toEqual([]);
    expect(forks[0]?.options).toEqual({
      serviceName: 'Premium',
      stdio: 'ignore',
      env: { SYSTEMROOT: 'C:\\Windows', TEMP: 'C:\\Temp', TMP: 'C:\\Temp' },
      execArgv: [],
    });
  });

  it('leaves out a variable the host does not have, and passes nothing else', () => {
    expect(workerEnv({ TEMP: 'x', PATH: 'y', BFC_FLAVOR: 'dev' })).toEqual({ TEMP: 'x' });
    expect(workerEnv({})).toEqual({});
  });

  it('posts one init message with the sequence, version, granted list and two ports', () => {
    const { supervisor, forks, channels } = rig();
    supervisor.start(bundle(FIXTURE_WORKER, ['fixture.ping']));
    const post = forks[0]?.child.posted[0];
    expect(post?.message).toEqual({ t: 'init', sequence: 4, version: '1.0.0', granted: [] });
    expect(post?.transfer).toEqual([channels[0]?.port2, channels[1]?.port2]);
  });

  it('sends the worker bytes over the second port as a copy', () => {
    const { supervisor, channels } = rig();
    const code = new Uint8Array([1, 2, 3, 4]);
    supervisor.start(bundle(code));
    const sent = channels[1]?.port1.sent[0];
    expect(sent).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(sent as ArrayBuffer)]).toEqual([1, 2, 3, 4]);
    expect(sent).not.toBe(code.buffer);
    expect(channels[0]?.port1.sent).toEqual([]);
  });

  it('reports the worker process id while it runs', () => {
    const { supervisor } = rig();
    expect(supervisor.pid()).toBeNull();
    supervisor.start(bundle());
    expect(supervisor.pid()).toBe(1000);
  });
});

describe('stop and exit', () => {
  it('kills the process, answers pending calls stopped, and reports the exit as requested', async () => {
    const { supervisor, forks, channels, exits } = rig();
    supervisor.start(bundle());
    channels[0]?.port2.postMessage({ id: 9, capability: 'fixture.ping', args: null });
    await flush();
    expect(channels[0]?.port2.sent).toHaveLength(1);

    supervisor.stop();
    expect(forks[0]?.child.killed).toBe(1);
    await flush();
    expect(exits).toEqual([true]);
    expect(channels[0]?.port1.closed).toBe(true);
    expect(supervisor.pid()).toBeNull();
  });

  it('answers a call that is still pending when it stops', async () => {
    // A handler that never settles keeps the call pending; stop must still answer it.
    const forks: FakeChild[] = [];
    const channels: FakePair[] = [];
    const supervisor = createWorkerSupervisor({
      fork: () => {
        const child = new FakeChild(1);
        forks.push(child);
        return child;
      },
      createChannel: () => {
        const made = pair();
        channels.push(made);
        return made;
      },
      loaderPath: 'loader',
      vars: {},
      allowlist: new Map([['hang', () => new Promise<never>(() => undefined)]]),
      now: () => 0,
      log: createLogSink(),
    });
    supervisor.start(bundle(FIXTURE_WORKER, ['hang']));
    const replies: unknown[] = [];
    channels[0]?.port2.on('message', ({ data }) => replies.push(data));
    channels[0]?.port2.start();
    channels[0]?.port2.postMessage({ id: 5, capability: 'hang', args: null });
    await flush();
    supervisor.stop();
    await flush();
    expect(replies).toContainEqual({ id: 5, ok: false, error: 'stopped' });
  });

  it('reports an exit nobody asked for as not requested', async () => {
    const { supervisor, forks, exits, log } = rig();
    supervisor.start(bundle());
    forks[0]?.child.exit(1);
    expect(exits).toEqual([false]);
    expect(supervisor.pid()).toBeNull();
    expect(log.records.at(-1)).toEqual({ scope: 'premium', event: 'premium.worker_exit', requested: false, code: 1 });
    await flush();
  });

  it('stopping with nothing running does nothing', () => {
    const { supervisor, exits } = rig();
    supervisor.stop();
    expect(exits).toEqual([]);
  });

  it('starting again stops the first worker, and its late exit is reported as requested', async () => {
    const { supervisor, forks, exits } = rig();
    supervisor.start(bundle());
    supervisor.start(bundle());
    expect(forks).toHaveLength(2);
    expect(forks[0]?.child.killed).toBe(1);
    expect(supervisor.pid()).toBe(1001);
    await flush();
    expect(exits).toEqual([true]);
  });

  it('forwards pause and resume to the running channel only', async () => {
    const { supervisor, channels } = rig();
    supervisor.pause();
    supervisor.start(bundle());
    supervisor.pause();
    supervisor.resume();
    expect(channels[0]?.port1.sent).toEqual([{ t: 'paused' }, { t: 'resumed' }]);
    await flush();
  });
});

describe('the loader with the fixture worker', () => {
  it('compiles the worker from the buffer and answers a ping through host', async () => {
    const { supervisor, channels } = rig({ loader: true });
    supervisor.start(bundle());
    await flush();

    // The worker's call reached the host side of the capability channel and was refused there.
    const reply = channels[0]?.port1.sent.find((m) => (m as { id?: number }).id === 1);
    expect(reply).toEqual({ id: 1, ok: false, error: 'not_granted' });
  });

  it('delivers paused and resumed to the worker', async () => {
    const { supervisor, channels } = rig({ loader: true });
    supervisor.start(bundle());
    await flush();
    supervisor.pause();
    supervisor.resume();
    await flush();
    expect(channels[0]?.port1.sent).toContainEqual({ t: 'paused' });
    expect(channels[0]?.port1.sent).toContainEqual({ t: 'resumed' });
  });

  it('refuses require of a built-in without the node: prefix and of electron', async () => {
    const probe = Buffer.from(
      `'use strict';
      const out = [];
      for (const id of ['fs', 'electron', './x', 'node:path']) {
        try { require(id); out.push([id, 'ok']); } catch (e) { out.push([id, e.message]); }
      }
      module.exports.start = (host) => { host.call('report', out).catch(() => {}); };`,
    );
    const { supervisor, channels } = rig({ loader: true });
    supervisor.start(bundle(new Uint8Array(probe)));
    await flush();
    const call = channels[0]?.port2.sent.find((m) => (m as { capability?: string }).capability === 'report');
    // The worker posts its probe results as the arguments of one call.
    expect((call as { args: unknown } | undefined)?.args).toEqual([
      ['fs', 'module_not_allowed'],
      ['electron', 'module_not_allowed'],
      ['./x', 'module_not_allowed'],
      ['node:path', 'ok'],
    ]);
  });

  it('ends the process when the bundle throws while loading', async () => {
    const { supervisor, exitCodes, exits } = rig({ loader: true });
    supervisor.start(bundle(new Uint8Array(Buffer.from("throw new Error('boom');"))));
    await flush();
    expect(exitCodes).toEqual([1]);
    expect(exits).toEqual([false]);
  });

  it('ends the process when the bytes are not code it can read', async () => {
    const { supervisor, exitCodes } = rig({ loader: true });
    supervisor.start(bundle(new Uint8Array(Buffer.from('this is not ( javascript'))));
    await flush();
    expect(exitCodes).toEqual([1]);
  });
});
