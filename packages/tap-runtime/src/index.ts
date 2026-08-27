import * as frida from 'frida';
import { TAP_SCRIPT_SOURCE } from './script-source.js';

/**
 * Mirrors the port declared by the desktop app's `runtime.ts` — this package cannot import that
 * type directly (a package depending on an app would run the dependency graph backwards), so it
 * restates the same shape here and relies on structural typing to satisfy it at the one call site
 * that matters: `createTapRuntime()` returned to the app's lazy `import()`.
 */
export interface TapReadEvent {
  readonly ctx: string | number;
  readonly bytes: Uint8Array;
}

export interface TapInterceptor {
  onRead(listener: (event: TapReadEvent) => void): void;
  detach(): void;
}

export interface TapSession {
  readonly pid: number;
  installInterceptor(address: number): TapInterceptor;
  detach(): Promise<void>;
}

export interface TapRuntime {
  attach(pid: number): Promise<TapSession>;
}

export interface LogPort {
  info(record: Record<string, unknown>): void;
}

const NOOP_LOG_PORT: LogPort = { info: () => undefined };

export interface FridaMessage {
  readonly type: string;
  readonly payload?: unknown;
  readonly description?: string;
  readonly stack?: string;
}

export interface FridaScript {
  readonly message: { connect(handler: (message: FridaMessage, data: Buffer | null) => void): void };
  load(): Promise<void>;
  unload(): Promise<void>;
  post(message: unknown, data?: Buffer | null): void;
}

export interface FridaSession {
  createScript(source: string, options?: { readonly runtime?: unknown }): Promise<FridaScript>;
  detach(): Promise<void>;
}

interface ReadPayload {
  readonly type: 'read';
  readonly address: number;
  readonly ctx: string | number;
}

function isReadPayload(payload: unknown): payload is ReadPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const candidate = payload as { readonly type?: unknown; readonly address?: unknown };
  return candidate.type === 'read' && typeof candidate.address === 'number';
}

interface HookInstalledPayload {
  readonly type: 'hook_installed';
  readonly address: number;
  readonly base: string;
  readonly absoluteAddress: string;
}

function isHookInstalledPayload(payload: unknown): payload is HookInstalledPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const candidate = payload as { readonly type?: unknown };
  return candidate.type === 'hook_installed';
}

class FridaTapInterceptor implements TapInterceptor {
  readonly #address: number;
  readonly #script: FridaScript;
  readonly #listeners: Map<number, (event: TapReadEvent) => void>;
  #detached = false;

  constructor(address: number, script: FridaScript, listeners: Map<number, (event: TapReadEvent) => void>) {
    this.#address = address;
    this.#script = script;
    this.#listeners = listeners;
  }

  onRead(listener: (event: TapReadEvent) => void): void {
    this.#listeners.set(this.#address, listener);
  }

  detach(): void {
    if (this.#detached) return;
    this.#detached = true;
    this.#listeners.delete(this.#address);
    try {
      this.#script.post({ type: 'detach', address: this.#address });
    } catch {
      // The session may already be torn down (process exit, prior session.detach()); a detach
      // request to a dead script has nothing left to reach and is not an error here.
    }
  }
}

class FridaTapSession implements TapSession {
  readonly pid: number;
  readonly #session: FridaSession;
  readonly #script: FridaScript;
  readonly #listeners: Map<number, (event: TapReadEvent) => void>;
  readonly #log: LogPort;
  #detached = false;

  constructor(
    pid: number,
    session: FridaSession,
    script: FridaScript,
    listeners: Map<number, (event: TapReadEvent) => void>,
    log: LogPort,
  ) {
    this.pid = pid;
    this.#session = session;
    this.#script = script;
    this.#listeners = listeners;
    this.#log = log;
  }

  installInterceptor(address: number): TapInterceptor {
    this.#script.post({ type: 'install', address });
    return new FridaTapInterceptor(address, this.#script, this.#listeners);
  }

  detach(): Promise<void> {
    if (this.#detached) return Promise.resolve();
    this.#detached = true;
    return this.#teardown();
  }

  async #teardown(): Promise<void> {
    try {
      await this.#script.unload();
    } catch (error) {
      this.#log.info({ scope: 'tap-runtime', event: 'session.script_unload_failed', pid: this.pid, error: String(error) });
    }
    try {
      await this.#session.detach();
    } catch (error) {
      this.#log.info({ scope: 'tap-runtime', event: 'session.session_detach_failed', pid: this.pid, error: String(error) });
    }
  }
}

export interface FridaTapRuntimeDeps {
  readonly attach?: (pid: number) => Promise<FridaSession>;
  readonly log?: LogPort;
}

export class FridaTapRuntime implements TapRuntime {
  readonly #attach: (pid: number) => Promise<FridaSession>;
  readonly #log: LogPort;

  constructor(deps: FridaTapRuntimeDeps = {}) {
    this.#attach = deps.attach ?? ((pid) => frida.attach(pid));
    this.#log = deps.log ?? NOOP_LOG_PORT;
  }

  async attach(pid: number): Promise<TapSession> {
    const session = await this.#attach(pid);

    let script: FridaScript;
    try {
      script = await session.createScript(TAP_SCRIPT_SOURCE, { runtime: frida.ScriptRuntime.V8 });
    } catch (error) {
      await session.detach().catch(() => undefined);
      throw error;
    }

    const listeners = new Map<number, (event: TapReadEvent) => void>();
    script.message.connect((message, data) => {
      if (message.type === 'error') {
        this.#log.info({
          scope: 'tap-runtime',
          event: 'script.error',
          pid,
          description: message.description,
          stack: message.stack,
        });
        return;
      }
      if (message.type !== 'send') return;
      const payload = message.payload;
      if (isHookInstalledPayload(payload)) {
        this.#log.info({
          scope: 'tap-runtime',
          event: 'hook.installed',
          pid,
          address: payload.address,
          base: payload.base,
          absoluteAddress: payload.absoluteAddress,
        });
        return;
      }
      if (!data || !isReadPayload(payload)) return;
      const listener = listeners.get(payload.address);
      if (!listener) return;
      listener({ ctx: payload.ctx, bytes: new Uint8Array(data) });
    });

    try {
      await script.load();
    } catch (error) {
      await script.unload().catch(() => undefined);
      await session.detach().catch(() => undefined);
      throw error;
    }

    return new FridaTapSession(pid, session, script, listeners, this.#log);
  }
}

export function createTapRuntime(deps?: FridaTapRuntimeDeps): TapRuntime {
  return new FridaTapRuntime(deps);
}
