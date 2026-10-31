import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLogSink } from '../premium-test-support.js';
import { runLoader, type LoaderPort } from './worker-loader.js';
import {
  createWorkerSupervisor,
  workerEnv,
  type ForkWorker,
  type PortPair,
  type SupervisorPort,
  type WorkerChild,
  type WorkerForkOptions,
} from './worker-supervisor.js';

const nodeRequire = createRequire(__filename);

type Listener = (event: { data: unknown; ports?: readonly LoaderPort[] }) => void;

/** One end of an in-memory channel with Electron's event shape (`{data}`), delivered a tick later. */
class FakePort implements SupervisorPort, LoaderPort {
  peer: FakePort | null = null;
  readonly sent: unknown[] = [];
  closed = false;
  private readonly listeners: Listener[] = [];
  private started = false;
  private readonly queue: unknown[] = [];

  on(_event: 'message', listener: Listener): this {
    this.listeners.push(listener);
    return this;
  }
  postMessage(message: unknown): void {
    this.sent.push(message);
    const target = this.peer;
    if (target === null || this.closed) return;
    queueMicrotask(() => {
      target.deliver(message);
    });
  }
  start(): void {
    this.started = true;
    for (const message of this.queue.splice(0)) this.deliver(message);
  }
  close(): void {
    this.closed = true;
  }
  deliver(message: unknown): void {
    if (!this.started) {
      this.queue.push(message);
      return;
    }
    for (const listener of this.listeners) listener({ data: message });
  }
}

function pair(): PortPair & { port1: FakePort; port2: FakePort } {
  const port1 = new FakePort();
  const port2 = new FakePort();
  port1.peer = port2;
  port2.peer = port1;
  return { port1, port2 };
}

interface ForkRecord {
  modulePath: string;
  args: string[];
  options: WorkerForkOptions;
  child: FakeChild;
}

class FakeChild implements WorkerChild {
  pid: number | undefined;
  killed = 0;
  posted: Array<{ message: unknown; transfer: unknown[] | undefined }> = [];
  private readonly exits: Array<(code: number) => void> = [];
  constructor(pid: number) {
    this.pid = pid;
  }
  postMessage(message: unknown, transfer?: unknown[]): void {
    this.posted.push({ message, transfer });
    this.onPost?.(message, transfer);
  }
  onPost: ((message: unknown, transfer: unknown[] | undefined) => void) | null = null;
  kill(): boolean {
    this.killed += 1;
    queueMicrotask(() => {
      this.exit(0);
    });
    return true;
  }
  on(_event: 'exit', listener: (code: number) => void): this {
    this.exits.push(listener);
    return this;
  }
  exit(code: number): void {
    for (const listener of this.exits) listener(code);
  }
}

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
  channels: Array<ReturnType<typeof pair>>;
  supervisor: ReturnType<typeof createWorkerSupervisor>;
  log: ReturnType<typeof createLogSink>;
  exits: boolean[];
  exitCodes: number[];
} {
  const forks: ForkRecord[] = [];
  const channels: Array<ReturnType<typeof pair>> = [];
  const exitCodes: number[] = [];
  const log = createLogSink();
  const fork: ForkWorker = (modulePath, args, forkOptions) => {
    const child = new FakeChild(1000 + forks.length);
    forks.push({ modulePath, args, options: forkOptions, child });
    if (options.loader === true) {
      // The child side: the real loader, fed the init message and ports the supervisor posts.
      let deliver: Listener | null = null;
      runLoader({
        parentPort: {
          on: (_event, listener) => {
            deliver = listener;
          },
        },
        nodeRequire: (id): unknown => nodeRequire(id) as unknown,
        exit: (code) => {
          exitCodes.push(code);
          child.exit(code);
        },
      });
      child.onPost = (message, transfer) => {
        queueMicrotask(() => {
          deliver?.({ data: message, ports: (transfer ?? []) as LoaderPort[] });
        });
      };
    }
    return child;
  };
  const supervisor = createWorkerSupervisor({
    fork,
    createChannel: () => {
      const made = pair();
      channels.push(made);
      return made;
    },
    loaderPath: '/app/dist/main/premium-worker.cjs',
    vars: VARS,
    allowlist: new Map(),
    now: () => 0,
    log,
  });
  const exits: boolean[] = [];
  supervisor.onExit((requested) => exits.push(requested));
  return { forks, channels, supervisor, log, exits, exitCodes };
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
    const channels: Array<ReturnType<typeof pair>> = [];
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
