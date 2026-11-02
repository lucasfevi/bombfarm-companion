import { createRequire } from 'node:module';
import { runLoader, type LoaderPort } from './worker-loader.js';
import type { ForkWorker, PortPair, SupervisorPort, WorkerChild, WorkerForkOptions } from './worker-supervisor.js';

/** In-memory stand-ins for the worker process and its ports, shared by the host's tests. */

const nodeRequire = createRequire(__filename);

export type PortListener = (event: { data: unknown; ports?: readonly LoaderPort[] }) => void;

/** One end of an in-memory channel with Electron's event shape (`{data}`), delivered a tick later. */
export class FakePort implements SupervisorPort, LoaderPort {
  peer: FakePort | null = null;
  readonly sent: unknown[] = [];
  closed = false;
  private readonly listeners: PortListener[] = [];
  private started = false;
  private readonly queue: unknown[] = [];

  on(_event: 'message', listener: PortListener): this {
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

export type FakePair = PortPair & { port1: FakePort; port2: FakePort };

export function pair(): FakePair {
  const port1 = new FakePort();
  const port2 = new FakePort();
  port1.peer = port2;
  port2.peer = port1;
  return { port1, port2 };
}

export class FakeChild implements WorkerChild {
  pid: number | undefined;
  killed = 0;
  posted: Array<{ message: unknown; transfer: unknown[] | undefined }> = [];
  onPost: ((message: unknown, transfer: unknown[] | undefined) => void) | null = null;
  private readonly exits: Array<(code: number) => void> = [];
  constructor(pid: number) {
    this.pid = pid;
  }
  postMessage(message: unknown, transfer?: unknown[]): void {
    this.posted.push({ message, transfer });
    this.onPost?.(message, transfer);
  }
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

export interface ForkRecord {
  modulePath: string;
  args: string[];
  options: WorkerForkOptions;
  child: FakeChild;
}

export interface FakeFork {
  fork: ForkWorker;
  forks: ForkRecord[];
  /** Exit codes the real loader asked for, when it runs inside the fake child. */
  exitCodes: number[];
  /** The ports `createChannel` handed out, in order: capability, code, capability, code, ... */
  channels: FakePair[];
  createChannel: () => PortPair;
}

/** A fork whose child runs the real loader against the ports the supervisor sends, when `loader`. */
export function createFakeFork(options: { loader?: boolean } = {}): FakeFork {
  const forks: ForkRecord[] = [];
  const exitCodes: number[] = [];
  const channels: FakePair[] = [];
  const fork: ForkWorker = (modulePath, args, forkOptions) => {
    const child = new FakeChild(1000 + forks.length);
    forks.push({ modulePath, args, options: forkOptions, child });
    if (options.loader === true) {
      let deliver: PortListener | null = null;
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
  return {
    fork,
    forks,
    exitCodes,
    channels,
    createChannel: () => {
      const made = pair();
      channels.push(made);
      return made;
    },
  };
}
