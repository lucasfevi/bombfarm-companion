import type { HostToWorker, PremiumPauseReason } from '@bombfarm/contracts';
import type { LogPort } from '../../storage/index.js';
import {
  createCapabilityChannel,
  type CapabilityChannel,
  type CapabilityHandler,
  type CapabilityPort,
} from './capability-channel.js';

/**
 * Runs the verified worker bytes in a utility process: fork options fixed, one minimal
 * environment, one init message with two ports (the capability channel and the code), the bytes
 * over the second port, and a kill that answers every pending call. Electron is injected, so this
 * module is tested with a fake process.
 */

/** A message port as the supervisor uses it; `MessagePortMain` fits. */
export interface SupervisorPort extends CapabilityPort {
  postMessage(message: unknown): void;
}

export interface PortPair {
  readonly port1: SupervisorPort;
  /** Sent to the worker inside the init message. */
  readonly port2: unknown;
}

export interface WorkerForkOptions {
  readonly serviceName: string;
  readonly stdio: 'ignore';
  readonly env: Readonly<Record<string, string>>;
  readonly execArgv: readonly string[];
}

/** The part of Electron's `UtilityProcess` the supervisor uses. */
export interface WorkerChild {
  readonly pid: number | undefined;
  postMessage(message: unknown, transfer?: unknown[]): void;
  kill(): boolean;
  on(event: 'exit', listener: (code: number) => void): unknown;
}

export type ForkWorker = (modulePath: string, args: string[], options: WorkerForkOptions) => WorkerChild;

export interface WorkerBundle {
  readonly sequence: number;
  readonly version: string;
  readonly workerBytes: Uint8Array;
  /** The capabilities the manifest declares; the worker is granted the ones the host offers. */
  readonly requested: readonly string[];
}

export interface WorkerSupervisor {
  /** Starts a worker for this bundle, replacing (and stopping) any running one. */
  start(bundle: WorkerBundle): void;
  pause(reason?: PremiumPauseReason): void;
  resume(): void;
  /** Kills the worker, if any; every pending call is answered `stopped`. */
  stop(): void;
  /** Called when the worker exits: `requested` is true when the host asked for it. */
  onExit(listener: (requested: boolean) => void): () => void;
  /** The running worker's process id, or null; for tests. */
  pid(): number | null;
  /** The running bundle's sequence, or null while no worker runs. */
  sequence(): number | null;
}

export interface WorkerSupervisorDeps {
  readonly fork: ForkWorker;
  readonly createChannel: () => PortPair;
  /** The path of the built loader entry. */
  readonly loaderPath: string;
  /** The process environment the worker's own is picked from. */
  readonly vars: Readonly<Record<string, string | undefined>>;
  readonly allowlist: ReadonlyMap<string, CapabilityHandler>;
  readonly now: () => number;
  readonly log: LogPort;
}

/** The only variables a worker gets: Windows needs them for crypto and temp files. */
const WORKER_ENV_KEYS = ['SYSTEMROOT', 'TEMP', 'TMP'] as const;

export function workerEnv(vars: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of WORKER_ENV_KEYS) {
    const value = vars[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

/** The one place a message to the worker is built. */
function toWorker(message: HostToWorker): HostToWorker {
  return message;
}

interface Running {
  readonly sequence: number;
  readonly child: WorkerChild;
  readonly channel: CapabilityChannel;
  requested: boolean;
}

export function createWorkerSupervisor(deps: WorkerSupervisorDeps): WorkerSupervisor {
  const listeners = new Set<(requested: boolean) => void>();
  let current: Running | null = null;

  function retire(running: Running): void {
    running.requested = true;
    running.channel.close();
    running.child.kill();
  }

  return {
    start(bundle) {
      if (current !== null) {
        const old = current;
        current = null;
        retire(old);
      }
      const capability = deps.createChannel();
      const code = deps.createChannel();
      const channel = createCapabilityChannel({
        port: capability.port1,
        requested: bundle.requested,
        allowlist: deps.allowlist,
        sequence: bundle.sequence,
        now: deps.now,
        log: deps.log,
      });
      const child = deps.fork(deps.loaderPath, [], {
        serviceName: 'Premium',
        stdio: 'ignore',
        env: workerEnv(deps.vars),
        execArgv: [],
      });
      const running: Running = { sequence: bundle.sequence, child, channel, requested: false };
      current = running;

      child.on('exit', (exitCode) => {
        deps.log.info({
          scope: 'premium',
          event: 'premium.worker_exit',
          requested: running.requested,
          code: exitCode,
        });
        if (current === running) {
          current = null;
          channel.close();
        }
        for (const listener of [...listeners]) listener(running.requested);
      });

      child.postMessage(
        toWorker({ t: 'init', sequence: bundle.sequence, version: bundle.version, granted: channel.granted }),
        [capability.port2, code.port2],
      );
      // A copy, so the memory the host keeps for its own use is never handed away.
      code.port1.postMessage(bundle.workerBytes.slice().buffer);
    },

    pause(reason) {
      current?.channel.pause(reason);
    },

    resume() {
      current?.channel.resume();
    },

    stop() {
      if (current === null) return;
      const running = current;
      current = null;
      retire(running);
    },

    onExit(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    pid: () => current?.child.pid ?? null,

    sequence: () => current?.sequence ?? null,
  };
}
