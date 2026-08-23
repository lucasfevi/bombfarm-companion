/**
 * The narrow port onto the process-instrumentation runtime: attach to a process, install an
 * interceptor at an address, receive read callbacks, detach. The runtime itself is a native
 * module with per-platform prebuilds, so it may simply not exist on disk for this platform —
 * that is the normal case, not a failure, which is why resolving it goes through a lazy
 * `import()` inside a `try` rather than a static import at the top of this file.
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
  detach(): void;
}

export interface TapRuntime {
  attach(pid: number): Promise<TapSession>;
}

export type RuntimeResolver = () => Promise<TapRuntime>;

export interface LogPort {
  info(record: Record<string, unknown>): void;
}

const NOOP_LOG_PORT: LogPort = { info: () => undefined };

/** The one place the native module's specifier is written, so a test can swap the resolver
 *  wholesale and production code never repeats the string.
 *
 *  `@bombfarm/tap-runtime` wraps a native module with per-platform prebuilds, so the `import()`
 *  above can still fail on a platform with no prebuild, or when antivirus quarantines the binary
 *  after the fact — both land here as `{ kind: 'unavailable' }`, the designed normal path, not a
 *  startup error. */
export const RUNTIME_MODULE_SPECIFIER = '@bombfarm/tap-runtime';

async function importRuntime(): Promise<TapRuntime> {
  const mod = (await import(RUNTIME_MODULE_SPECIFIER)) as { createTapRuntime: () => TapRuntime };
  return mod.createTapRuntime();
}

export interface RuntimeResolved {
  readonly kind: 'ok';
  readonly runtime: TapRuntime;
}

export interface RuntimeUnavailable {
  readonly kind: 'unavailable';
  /** True when {@link RuntimePort.resolve} succeeded earlier in this same session and has now
   *  started failing — which is what antivirus quarantine looks like from here, since a missing
   *  prebuild fails from the very first attempt instead. */
  readonly likelyQuarantine: boolean;
}

export type RuntimeResolution = RuntimeResolved | RuntimeUnavailable;

export interface RuntimePortDeps {
  readonly resolve?: RuntimeResolver;
  readonly log?: LogPort;
}

/**
 * Wraps the lazy `import()` with the one thing a bare `import()` call cannot tell a caller on
 * its own: whether resolution ever succeeded earlier in this session. `resolve()` never throws —
 * a rejection becomes `{ kind: 'unavailable' }`, logged once at info level, since tap-absent is
 * an expected state on a platform with no prebuild, not a startup error.
 */
export class RuntimePort {
  readonly #resolve: RuntimeResolver;
  readonly #log: LogPort;
  #everResolved = false;

  constructor(deps: RuntimePortDeps = {}) {
    this.#resolve = deps.resolve ?? importRuntime;
    this.#log = deps.log ?? NOOP_LOG_PORT;
  }

  async resolve(): Promise<RuntimeResolution> {
    try {
      const runtime = await this.#resolve();
      this.#everResolved = true;
      return { kind: 'ok', runtime };
    } catch {
      const likelyQuarantine = this.#everResolved;
      this.#log.info({ scope: 'live-source', event: 'runtime.unavailable', likelyQuarantine });
      return { kind: 'unavailable', likelyQuarantine };
    }
  }
}
