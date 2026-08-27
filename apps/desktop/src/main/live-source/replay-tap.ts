import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { LiveCurrency, LiveEvent, LiveTick } from '@bombfarm/contracts';
import { liveGap } from '@bombfarm/contracts';
import { readCaptureRecords, type CaptureRecord } from './capture-format.js';
import type { TapHandle } from './live-source.js';
import type { LogPort } from './log-port.js';
import { TlsConnections } from './tls-stream.js';

/**
 * A {@link TapHandle} that replays a committed byte capture instead of attaching to the game.
 * Same output as the real tap — the recorded bytes go through the same `TlsConnections` decoder
 * — but no process is listed, no hook is discovered, and the instrumentation runtime is never
 * loaded. That last part is the point when the real game is running: a dev build in replay mode
 * cannot contend with a production build for the same process.
 *
 * Dev-only. `index.ts` builds this only when the app is unpackaged, so a packaged build has no
 * path to it whatever its environment says.
 */

/** The cadence the committed capture was recorded at — ~10 frames/second. */
export const REPLAY_FRAME_INTERVAL_MS = 100;

const LIVE_SOURCE_ENV_VAR = 'BFC_LIVE_SOURCE';
const CAPTURE_PATH_ENV_VAR = 'BFC_REPLAY_CAPTURE';

const COMMITTED_CAPTURE_RELATIVE = path.join(
  'src',
  'main',
  'live-source',
  'fixtures',
  'live-capture.bfcc',
);

/**
 * `isPackaged` is a parameter rather than something read here, so the caller has to pass
 * Electron's real answer and a packaged build cannot be talked into replay by its environment —
 * the same fail-closed shape `sessionCfgPath` uses for its token override.
 */
export function isReplayLiveSourceEnabled(
  env: Readonly<Record<string, string | undefined>>,
  isPackaged: boolean,
): boolean {
  return !isPackaged && env[LIVE_SOURCE_ENV_VAR] === 'replay';
}

/**
 * The capture is not bundled into `dist` — `build-electron.mjs` bundles code, not fixtures — so
 * this walks back to the source tree. The candidates cover being launched from `apps/desktop`
 * (what `scripts/dev.mjs` does) and from the repo root, and the first that exists wins. With none
 * present the first candidate is returned anyway, so the "capture missing" log names a real path
 * rather than an empty string.
 */
export function resolveReplayCapturePath(
  env: Readonly<Record<string, string | undefined>>,
  dirname: string,
): string {
  const override = env[CAPTURE_PATH_ENV_VAR];
  if (override !== undefined && override !== '') return override;

  const candidates = [
    path.resolve(dirname, '..', '..', COMMITTED_CAPTURE_RELATIVE),
    path.resolve(process.cwd(), COMMITTED_CAPTURE_RELATIVE),
    path.resolve(process.cwd(), 'apps', 'desktop', COMMITTED_CAPTURE_RELATIVE),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? (candidates[0] as string);
}

export interface ReplayTapDeps {
  readonly capturePath: string;
  /** Checked on every frame, not just at start, so a revoke stops the stream mid-replay exactly
   *  as it detaches the real tap. */
  readonly consent: () => boolean;
  readonly onEvent: (event: LiveEvent) => void;
  readonly onHttpBody?: (body: Buffer, atMs: number) => void;
  readonly log?: LogPort;
  readonly intervalMs?: number;
  readonly now?: () => Date;
}

const NOOP_LOG_PORT: LogPort = { info: () => undefined, warn: () => undefined };

function loadRecords(capturePath: string): readonly CaptureRecord[] {
  return [...readCaptureRecords(readFileSync(capturePath))];
}

class ReplayTap implements TapHandle {
  readonly #deps: ReplayTapDeps;
  readonly #log: LogPort;
  readonly #intervalMs: number;

  #records: readonly CaptureRecord[] = [];
  #connections = new TlsConnections();
  #cursor = 0;
  #sequence = 0;
  #timer: NodeJS.Timeout | null = null;
  #stopped = false;
  #currency: LiveCurrency;
  /** Total gold gained by every pass completed so far — see {@link ReplayTap.#carryGold}. */
  #goldCarried = 0;
  #passFirstGold: number | null = null;
  #passLastGold: number | null = null;

  constructor(deps: ReplayTapDeps) {
    this.#deps = deps;
    this.#log = deps.log ?? NOOP_LOG_PORT;
    this.#intervalMs = deps.intervalMs ?? REPLAY_FRAME_INTERVAL_MS;
    this.#currency = liveGap('neverAttached', this.#nowIso());
  }

  #nowIso(): string {
    return (this.#deps.now?.() ?? new Date()).toISOString();
  }

  #emitCurrency(next: LiveCurrency): void {
    this.#currency = next;
    this.#deps.onEvent({ type: 'currency', currency: next });
  }

  #reportGap(reason: Parameters<typeof liveGap>[0]): void {
    if (this.#currency.kind === 'gap' && this.#currency.reason === reason) return;
    this.#emitCurrency(liveGap(reason, this.#nowIso()));
  }

  #reportLive(): void {
    const now = this.#nowIso();
    this.#emitCurrency({ kind: 'live', lastFrameAt: now, sinceAt: now });
  }

  start(): void {
    if (this.#stopped) return;
    this.#emitCurrency(this.#currency);

    if (!existsSync(this.#deps.capturePath)) {
      this.#log.warn({
        scope: 'live-source',
        event: 'replay.capture_missing',
        path: this.#deps.capturePath,
      });
      this.#reportGap('attachFailed');
      return;
    }

    try {
      this.#records = loadRecords(this.#deps.capturePath);
    } catch (error) {
      this.#log.warn({
        scope: 'live-source',
        event: 'replay.capture_unreadable',
        path: this.#deps.capturePath,
        message: error instanceof Error ? error.message : String(error),
      });
      this.#reportGap('attachFailed');
      return;
    }

    if (this.#records.length === 0) {
      this.#log.warn({ scope: 'live-source', event: 'replay.capture_empty', path: this.#deps.capturePath });
      this.#reportGap('attachFailed');
      return;
    }

    this.#log.info({
      scope: 'live-source',
      event: 'replay.started',
      path: this.#deps.capturePath,
      records: this.#records.length,
      intervalMs: this.#intervalMs,
    });

    this.#timer = setInterval(() => {
      this.#pump();
    }, this.#intervalMs);
  }

  /** One record per tick, decoded and emitted before the cursor advances — so the pass's last
   *  record still goes through the decoder that has been reading the pass, not the fresh one
   *  {@link ReplayTap.#restartPass} installs for the next. */
  #pump(): void {
    if (this.#stopped) return;

    if (!this.#deps.consent()) {
      this.#reportGap('consentMissing');
      return;
    }

    const record = this.#records[this.#cursor];
    if (record === undefined) return;

    for (const event of this.#connections.push(record.ctx, record.bytes)) {
      if (event.kind === 'http' && event.body !== undefined) {
        this.#deps.onHttpBody?.(event.body, Date.now());
      }
      if (event.kind !== 'tick') continue;
      this.#sequence += 1;
      if (this.#currency.kind !== 'live') this.#reportLive();
      this.#deps.onEvent({
        type: 'frame',
        frame: { at: this.#nowIso(), sequence: this.#sequence, tick: this.#carryGold(event.tick) },
      });
    }

    this.#cursor += 1;
    if (this.#cursor >= this.#records.length) this.#restartPass();
  }

  /**
   * Gold on the wire is an account total, so replaying the capture from the top would hand the
   * app a balance that drops by a pass's whole takings every few seconds — and a rate read across
   * that seam is negative. Each completed pass's gain is carried into the next instead, so the
   * balance only ever climbs.
   *
   * Every gold figure the app sees is still the capture's: the deltas inside a pass are untouched,
   * and the first tick of a pass repeats the last tick's balance rather than inventing a step. It
   * is the continuity BETWEEN passes that is constructed, which is what looping already is.
   */
  #carryGold(tick: LiveTick): LiveTick {
    const raw = tick.gold;
    if (raw === undefined) return tick;
    if (this.#passFirstGold === null) this.#passFirstGold = raw;
    this.#passLastGold = raw;
    return this.#goldCarried === 0 ? tick : { ...tick, gold: raw + this.#goldCarried };
  }

  /** A pass is decoded from a fresh {@link TlsConnections}: the capture is a slice out of the
   *  middle of a live connection, so replaying it back-to-back into the same decoder would hand it
   *  a frame boundary that does not line up with where the previous pass stopped. */
  #restartPass(): void {
    this.#cursor = 0;
    this.#connections = new TlsConnections();
    if (this.#passFirstGold !== null && this.#passLastGold !== null) {
      this.#goldCarried += this.#passLastGold - this.#passFirstGold;
    }
    this.#passFirstGold = null;
    this.#passLastGold = null;
  }

  /** A fresh grant should not wait out an interval, matching the real tap's own `pollNow`. */
  pollNow(): void {
    if (this.#stopped || this.#timer === null) return;
    this.#pump();
  }

  teardown(): Promise<void> {
    this.#stopped = true;
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    return Promise.resolve();
  }
}

export function createReplayTapFactory(deps: {
  readonly capturePath: string;
  readonly consent: () => boolean;
  readonly log?: LogPort;
  readonly intervalMs?: number;
}): (onEvent: (event: LiveEvent) => void, onHttpBody: (body: Buffer, atMs: number) => void) => TapHandle {
  return (onEvent, onHttpBody) =>
    new ReplayTap({
      capturePath: deps.capturePath,
      consent: deps.consent,
      onEvent,
      onHttpBody,
      ...(deps.log !== undefined ? { log: deps.log } : {}),
      ...(deps.intervalMs !== undefined ? { intervalMs: deps.intervalMs } : {}),
    });
}
