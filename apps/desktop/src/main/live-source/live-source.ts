import { closeSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import type {
  AccountView,
  AppFlavor,
  FieldCountdown,
  FieldDrop,
  LiveCurrency,
  LiveDiagnosticsDumpOutcome,
  LiveEvent,
  LiveTick,
  LiveTickHero,
  LiveView,
  RecoveryCountdown,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { isLiveCurrency, liveGap } from '@bombfarm/contracts';
import { normalizeRotation } from '@bombfarm/game-api';
import {
  createInitialFieldCountdownState,
  freezeRecoveryCountdowns,
  ingestFieldCountdownTick,
  type FieldCountdownState,
} from '@bombfarm/domain/live';
import { runPowerShellAsync, runPowerShellSync, stripExeSuffix } from '../game-reader/process.js';
import { createFrameCapture, readFrameCaptureEnabledFromEnv } from './frame-capture.js';
import { FrameRing } from './frame-ring.js';
import type { LogPort } from './log-port.js';
import { RuntimePort } from './runtime.js';
import {
  createHookCandidateSource,
  createSystemClock,
  Tap,
  type ProcessImageSource,
  type ProcessLister,
  type TapTargetProcess,
} from './tap.js';

/**
 * The one module the rest of the app is allowed to see: every other file in this directory is an
 * implementation detail of *how* a live read happens, and this class is the only place their
 * output is turned into {@link LiveEvent}s and a folded {@link LiveView}. Events publish first —
 * synchronously, in arrival order, to every listener independently — and `getView()` is nothing
 * but a fold over what has been ingested so far, REST rotation as the base and tap frames overlaid
 * on top, so a future reader of the per-tick loot/hit fields this already carries is additive, not
 * a rewrite of how the sample is produced.
 */

const NOOP_LOG_PORT: LogPort = { info: () => undefined, warn: () => undefined };

const DEFAULT_PROCESS_NAME = process.env.BFC_GAME_PROCESS ?? 'BombFarm.exe';

/** ~10 frames/second at ~2 KB/frame: 50 frames is a 5-second window, big enough to see what led
 *  into a parse failure without holding more raw payload in memory than that. */
const FRAME_RING_MAX_FRAMES = 50;
const FRAME_RING_MAX_BYTES = 500_000;

/** Same ~2 KB/frame, ~10 frames/second basis, sized for a several-minute farming run (~1000s) so
 *  one capture session can seed a realistic replay fixture without an unbounded dev-machine file. */
const FRAME_CAPTURE_MAX_BYTES = 20_000_000;

function nodeFrameDumpWritePort(): { write(destination: string, contents: string): void } {
  return { write: (destination, contents) => { writeFileSync(destination, contents, 'utf8'); } };
}

/** Holds one open file handle across pushes instead of paying an open+write+close per frame.
 *  `close()` clears the handle rather than leaving it open, so reusing this port afterward (a
 *  consent-revoke reattach, say) reopens it lazily on the next append and keeps appending
 *  correctly. */
/**
 * One process writes one capture file. The first open truncates, because the format carries a
 * header exactly once and a run that appended to a previous run's file would bury a second header
 * mid-stream — which the reader cannot distinguish from a corrupt record, so it stops there and
 * silently discards everything after it. Reopening after `close()` appends, since that is the
 * same capture continuing across a tap teardown (a consent revoke reattaches the same instance).
 */
function nodeFrameCaptureAppendPort(destination: string): { append(bytes: Uint8Array): void; close(): void } {
  let fd: number | null = null;
  let openedThisProcess = false;

  function closeHandle(): void {
    if (fd === null) return;
    closeSync(fd);
    fd = null;
  }

  return {
    append: (bytes) => {
      if (fd === null) {
        fd = openSync(destination, openedThisProcess ? 'a' : 'w');
        openedThisProcess = true;
      }
      try {
        // writeSync is not obliged to consume the whole buffer, and a short write would truncate a
        // length-prefixed record and desync every record after it.
        let written = 0;
        while (written < bytes.length) {
          written += writeSync(fd, bytes, written, bytes.length - written);
        }
      } catch (error) {
        closeHandle();
        throw error;
      }
    },
    close: closeHandle,
  };
}

function heroPathWithoutIndex(path: string): string {
  return path.replace(/heroes\[\d+\]/g, 'heroes[]');
}

function reportRotationDrops(log: LogPort, drops: readonly FieldDrop[]): void {
  for (const drop of drops) {
    log.warn({
      scope: 'live-source',
      event: 'rotation.field_dropped',
      path: heroPathWithoutIndex(drop.path),
      reason: drop.reason,
    });
  }
}

export interface TapHandle {
  start(): void;
  teardown(): Promise<void>;
  pollNow(): void;
}

export interface LiveSourceDeps {
  /** Checked at the attach site by the underlying tap, never inferred from construction order. */
  readonly consent: () => boolean;
  readonly userDataDir: string;
  /** Gates the frame capture inside the default tap factory — irrelevant, and safe to omit, when
   *  `createTap` overrides that factory entirely. Defaults to `'prod'`, the flavor capture never
   *  runs under. */
  readonly flavor?: AppFlavor;
  readonly processName?: string;
  readonly log?: LogPort;
  readonly now?: () => number;
  /** Test seam: overrides how the underlying attach mechanism is built. Production leaves this
   *  unset and gets a real tap wired against this machine's process list and instrumentation
   *  runtime. */
  readonly createTap?: (onEvent: (event: LiveEvent) => void) => TapHandle;
}

function createProcessLister(): ProcessLister {
  return {
    async list(processName: string): Promise<readonly TapTargetProcess[]> {
      const baseName = stripExeSuffix(processName);
      try {
        const script = `Get-Process -Name '${baseName}' -ErrorAction SilentlyContinue | Select-Object Id,ProcessName | ConvertTo-Json -Compress`;
        const out = await runPowerShellAsync(script);
        if (!out) return [];
        const parsed: unknown = JSON.parse(out);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        return rows
          .map((row) => {
            const record = row as { Id?: unknown; ProcessName?: unknown };
            const name = typeof record.ProcessName === 'string' ? record.ProcessName : processName;
            return { pid: Number(record.Id), name };
          })
          .filter((candidate): candidate is TapTargetProcess => Number.isFinite(candidate.pid) && candidate.pid > 0);
      } catch {
        return [];
      }
    },
  };
}

function createProcessImageSource(): ProcessImageSource {
  return {
    read(pid: number): Buffer | null {
      try {
        const script = `(Get-Process -Id ${String(pid)} -ErrorAction SilentlyContinue).Path`;
        const out = runPowerShellSync(script);
        return out ? readFileSync(out) : null;
      } catch {
        return null;
      }
    },
  };
}

function createFrameRing(deps: { readonly userDataDir: string; readonly log: LogPort }): FrameRing {
  return new FrameRing({
    maxFrames: FRAME_RING_MAX_FRAMES,
    maxBytes: FRAME_RING_MAX_BYTES,
    dumpPath: path.join(deps.userDataDir, 'live-frame-dump.json'),
    writePort: nodeFrameDumpWritePort(),
    log: deps.log,
  });
}

function createDefaultTapFactory(deps: {
  readonly consent: () => boolean;
  readonly userDataDir: string;
  readonly processName: string;
  readonly flavor: AppFlavor;
  readonly log: LogPort;
  readonly ring: FrameRing;
}): (onEvent: (event: LiveEvent) => void) => TapHandle {
  const ring = deps.ring;

  const capture = createFrameCapture({
    flavor: deps.flavor,
    enabled: readFrameCaptureEnabledFromEnv(process.env),
    maxBytes: FRAME_CAPTURE_MAX_BYTES,
    appendPort: nodeFrameCaptureAppendPort(path.join(deps.userDataDir, 'live-frame-capture.bin')),
    log: deps.log,
  });

  return (onEvent) => {
    const tap = new Tap({
      processName: deps.processName,
      runtime: new RuntimePort({ log: deps.log }),
      processes: createProcessLister(),
      candidates: createHookCandidateSource({
        cacheDir: path.join(deps.userDataDir, 'live-hook-cache'),
        image: createProcessImageSource(),
        log: deps.log,
      }),
      consent: deps.consent,
      clock: createSystemClock(),
      onEvent,
      log: deps.log,
      ring,
      capture,
    });
    return {
      start: () => {
        tap.start();
      },
      teardown: async () => {
        await tap.teardown();
        capture.close();
      },
      pollNow: () => {
        tap.pollNow();
      },
    };
  };
}

function fieldHeroesFromRotation(rotation: RotationSnapshot): readonly LiveTickHero[] {
  return rotation.heroes
    .filter((hero) => hero.activity === 'inField' || hero.onField === true)
    .map((hero) => ({
      id: hero.id,
      ...(hero.energyFraction !== undefined ? { energyFraction: hero.energyFraction } : {}),
    }));
}

export class LiveSource {
  readonly #log: LogPort;
  readonly #now: () => number;
  readonly #createTap: (onEvent: (event: LiveEvent) => void) => TapHandle;
  /** `null` under the `createTap` test seam, which bypasses the default factory and therefore
   *  never owns a ring of its own. */
  readonly #ring: FrameRing | null;

  #tap: TapHandle;
  #listeners: Array<(event: LiveEvent) => void> = [];

  #currency: LiveCurrency;
  #rotation: RotationSnapshot | null = null;
  #fieldState: FieldCountdownState = createInitialFieldCountdownState();
  #field: readonly FieldCountdown[] = [];
  #recovery: readonly RecoveryCountdown[] = [];
  #updatedAt: string;

  constructor(deps: LiveSourceDeps) {
    this.#log = deps.log ?? NOOP_LOG_PORT;
    this.#now = deps.now ?? Date.now;
    if (deps.createTap) {
      this.#createTap = deps.createTap;
      this.#ring = null;
    } else {
      const ring = createFrameRing({ userDataDir: deps.userDataDir, log: this.#log });
      this.#ring = ring;
      this.#createTap = createDefaultTapFactory({
        consent: deps.consent,
        userDataDir: deps.userDataDir,
        processName: deps.processName ?? DEFAULT_PROCESS_NAME,
        flavor: deps.flavor ?? 'prod',
        log: this.#log,
        ring,
      });
    }
    this.#currency = liveGap('neverAttached', this.#nowIso());
    this.#updatedAt = this.#nowIso();
    this.#tap = this.#createTap((event) => {
      this.#handleTapEvent(event);
    });
  }

  start(): void {
    this.#tap.start();
  }

  /** Owns the frame ring, so this is the one place `index.ts` can hand it the same single-slot
   *  credential redactor the boundary log gets, keeping the ring's dump provably free of the
   *  session token — not just `account_id`/`player_name`. */
  setCredentialRedactor(redact: ((text: string) => string) | null): void {
    this.#ring?.setCredentialRedactor(redact);
  }

  /** Mirrors `AccountRefreshHandle.onConsentChanged`: called from the same consent-changed path
   *  in index.ts, so a grant is picked up without waiting out the tap's poll interval. Consent
   *  itself is always re-read from the gate the tap already holds — this only wakes the loop. */
  pollNow(): void {
    this.#tap.pollNow();
  }

  /** `no-source` (never `dumpToDisk`'s own concern) covers the `createTap` test seam and the
   *  window before any tap has attached, where there is no ring to own the dump at all. */
  dumpDiagnostics(): LiveDiagnosticsDumpOutcome {
    return this.#ring?.dumpToDisk('manual') ?? { written: false, reason: 'no-source' };
  }

  subscribe(listener: (event: LiveEvent) => void): () => void {
    this.#listeners.push(listener);
    return () => {
      this.#listeners = this.#listeners.filter((candidate) => candidate !== listener);
    };
  }

  getView(): LiveView {
    const recovery = isLiveCurrency(this.#currency) ? this.#recovery : freezeRecoveryCountdowns(this.#fieldState);
    return {
      currency: this.#currency,
      field: this.#field,
      recovery,
      rotation: this.#rotation,
      updatedAt: this.#updatedAt,
    };
  }

  /** The REST rotation projection: the base view every countdown falls back to when no live tap
   *  frame is available. Left untouched (never set to an empty snapshot) until a `/rotation` read
   *  actually resolves, so {@link LiveView.rotation} stays `null` rather than lying about having
   *  seen an account with no heroes. */
  ingestRotation(view: AccountView): void {
    if (view.payload.casa === undefined) return;
    const { snapshot, drops } = normalizeRotation(view.payload.casa, view.payload.heroes);
    reportRotationDrops(this.#log, drops);
    this.#rotation = snapshot;
    if (isLiveCurrency(this.#currency)) {
      this.#touch();
      return;
    }
    this.#ingestTick({ heroes: fieldHeroesFromRotation(snapshot) }, this.#now(), 'rest');
  }

  /** Consent revoke has to win the race against a tap already attached: the tap's own poll loop
   *  only consults the consent predicate before attaching, so a session already reading real
   *  traffic would otherwise keep doing so until the game process exits. Tearing the current tap
   *  down and replacing it with a fresh one — which re-applies that same consent gate on its very
   *  first poll — is the only way to force an immediate stop, while this object, the one the rest
   *  of the app holds, never changes identity. */
  async forceDetach(): Promise<void> {
    // Replacement must run even if teardown rejects (e.g. an in-flight attach's resolve() throws),
    // or #tap is left pointing at an instance whose poll loop is permanently stopped.
    try {
      await this.#tap.teardown();
    } finally {
      this.#tap = this.#createTap((event) => {
        this.#handleTapEvent(event);
      });
      this.#tap.start();
    }
  }

  async teardown(): Promise<void> {
    await this.#tap.teardown();
  }

  #handleTapEvent(event: LiveEvent): void {
    if (event.type === 'currency') {
      this.#currency = event.currency;
      this.#touch();
    } else {
      this.#ingestTick(event.frame.tick, Date.parse(event.frame.at));
    }
    this.#publish(event);
  }

  #ingestTick(tick: LiveTick, atMs: number, sampleSource: 'tap' | 'rest' = 'tap'): void {
    const result = ingestFieldCountdownTick(this.#fieldState, { tick, rotation: this.#rotation, atMs, sampleSource });
    this.#fieldState = result.state;
    this.#field = result.field;
    this.#recovery = result.recovery;
    this.#touch();
  }

  #touch(): void {
    this.#updatedAt = this.#nowIso();
  }

  #nowIso(): string {
    return new Date(this.#now()).toISOString();
  }

  #publish(event: LiveEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.#log.warn({ scope: 'live-source', event: 'listener.threw', error: String(error) });
      }
    }
  }
}
