import { compileFunction } from 'node:vm';

/**
 * The fixed entry of the Premium worker process. It holds no Premium logic: it waits for the init
 * message, takes the verified worker bytes from the second port, compiles them from the buffer
 * (never from a path) and hands the bundle a small `host` object. `vm` is a loader here, not a
 * security boundary; the process is the boundary.
 */

/** What the loader uses of a message port; Electron's `MessagePortMain` fits. */
export interface LoaderPort {
  on(event: 'message', listener: (event: { data: unknown; ports?: readonly LoaderPort[] }) => void): unknown;
  postMessage(message: unknown): void;
  start(): void;
}

export interface LoaderDeps {
  /** `process.parentPort`: where the init message and the two ports arrive. */
  readonly parentPort: Pick<LoaderPort, 'on'>;
  readonly nodeRequire: (id: string) => unknown;
  /** Ends the process; the host sees the exit and applies its restart rule. */
  readonly exit: (code: number) => void;
}

type PauseListener = () => void;

export interface WorkerHost {
  readonly info: Readonly<{ sequence: number; version: string; granted: readonly string[] }>;
  call(capability: string, args?: unknown): Promise<unknown>;
  on(event: 'paused' | 'resumed', listener: PauseListener): void;
}

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

interface InitMessage {
  readonly sequence: number;
  readonly version: string;
  readonly granted: readonly string[];
}

export const WORKER_FILENAME = 'premium/worker/index.cjs';

function readInit(data: unknown): InitMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const { t, sequence, version, granted } = data as Record<string, unknown>;
  if (t !== 'init' || typeof sequence !== 'number' || typeof version !== 'string' || !Array.isArray(granted)) return null;
  if (!granted.every((name): name is string => typeof name === 'string')) return null;
  return { sequence, version, granted };
}

function textOf(data: unknown): string | null {
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  return null;
}

function refusal(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function createHost(init: InitMessage, port: LoaderPort): WorkerHost {
  const pending = new Map<number, Pending>();
  const listeners: Record<'paused' | 'resumed', PauseListener[]> = { paused: [], resumed: [] };
  let nextId = 1;

  port.on('message', ({ data }) => {
    if (typeof data !== 'object' || data === null) return;
    const message = data as Record<string, unknown>;
    if (message['t'] === 'paused' || message['t'] === 'resumed') {
      for (const listener of listeners[message['t']]) listener();
      return;
    }
    const id = message['id'];
    if (typeof id !== 'number') return;
    const waiting = pending.get(id);
    if (waiting === undefined) return;
    pending.delete(id);
    if (message['ok'] === true) waiting.resolve(message['value']);
    else waiting.reject(refusal(String(message['error'])));
  });
  port.start();

  return {
    info: Object.freeze({ sequence: init.sequence, version: init.version, granted: Object.freeze([...init.granted]) }),
    call(capability, args) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        port.postMessage({ id, capability, args });
      });
    },
    on(event, listener) {
      listeners[event].push(listener);
    },
  };
}

/** Only `node:` built-ins; a bundle is self-contained, so anything else is not its to load. */
function restrictedRequire(nodeRequire: (id: string) => unknown): (id: string) => unknown {
  return (id) => {
    if (typeof id !== 'string' || !id.startsWith('node:')) throw refusal('module_not_allowed');
    return nodeRequire(id);
  };
}

function run(code: string, host: WorkerHost, deps: LoaderDeps): void {
  const module = { exports: {} as Record<string, unknown> };
  const body = compileFunction(code, ['require', 'module', 'exports', 'host'], { filename: WORKER_FILENAME });
  (body as (...args: unknown[]) => unknown)(restrictedRequire(deps.nodeRequire), module, module.exports, host);
  const start = module.exports['start'];
  if (typeof start === 'function') (start as (host: WorkerHost) => unknown)(host);
}

/** Wires the loader to its parent port; returns when the listeners are in place. */
export function runLoader(deps: LoaderDeps): void {
  let started = false;
  deps.parentPort.on('message', ({ data, ports }) => {
    if (started) return;
    const init = readInit(data);
    const [channel, codePort] = ports ?? [];
    if (init === null || channel === undefined || codePort === undefined) return;
    started = true;

    const host = createHost(init, channel);
    let loaded = false;
    codePort.on('message', ({ data: bytes }) => {
      if (loaded) return;
      loaded = true;
      const code = textOf(bytes);
      if (code === null) {
        deps.exit(1);
        return;
      }
      try {
        run(code, host, deps);
      } catch {
        // The bundle failed to load or to start; the host sees the exit, not the message.
        deps.exit(1);
      }
    });
    codePort.start();
  });
}

interface ParentProcess {
  readonly parentPort?: LoaderDeps['parentPort'];
  readonly exit: (code?: number) => never;
}

// Under Electron's utility process `parentPort` exists; anywhere else (tests) importing is inert.
const hostProcess = process as unknown as ParentProcess;
if (hostProcess.parentPort !== undefined) {
  runLoader({
    parentPort: hostProcess.parentPort,
    nodeRequire: require,
    exit: (code) => hostProcess.exit(code),
  });
}
