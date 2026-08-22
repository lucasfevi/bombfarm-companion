import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  AccountView,
  FieldCountdown,
  LiveCurrency,
  LiveEvent,
  LiveTick,
  LiveTickHero,
  LiveView,
  RecoveryCountdown,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { liveGap } from '@bombfarm/contracts';
import { normalizeRotation } from '@bombfarm/game-api';
import {
  createInitialFieldCountdownState,
  freezeRecoveryCountdowns,
  ingestFieldCountdownTick,
  type FieldCountdownState,
} from '@bombfarm/domain/live';
import { runPowerShellAsync, runPowerShellSync, stripExeSuffix } from '../game-reader/process.js';
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

export interface LogPort {
  info(record: Record<string, unknown>): void;
  warn(record: Record<string, unknown>): void;
}

const NOOP_LOG_PORT: LogPort = { info: () => undefined, warn: () => undefined };

const DEFAULT_PROCESS_NAME = process.env.BFC_GAME_PROCESS ?? 'BombFarm.exe';

export interface TapHandle {
  start(): void;
  teardown(): Promise<void>;
}

export interface LiveSourceDeps {
  /** Checked at the attach site by the underlying tap, never inferred from construction order. */
  readonly consent: () => boolean;
  readonly userDataDir: string;
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

function createDefaultTapFactory(deps: {
  readonly consent: () => boolean;
  readonly userDataDir: string;
  readonly processName: string;
  readonly log: LogPort;
}): (onEvent: (event: LiveEvent) => void) => TapHandle {
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
    });
    return {
      start: () => {
        tap.start();
      },
      teardown: () => tap.teardown(),
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
    this.#createTap =
      deps.createTap ??
      createDefaultTapFactory({
        consent: deps.consent,
        userDataDir: deps.userDataDir,
        processName: deps.processName ?? DEFAULT_PROCESS_NAME,
        log: this.#log,
      });
    this.#currency = liveGap('neverAttached', this.#nowIso());
    this.#updatedAt = this.#nowIso();
    this.#tap = this.#createTap((event) => {
      this.#handleTapEvent(event);
    });
  }

  start(): void {
    this.#tap.start();
  }

  subscribe(listener: (event: LiveEvent) => void): () => void {
    this.#listeners.push(listener);
    return () => {
      this.#listeners = this.#listeners.filter((candidate) => candidate !== listener);
    };
  }

  getView(): LiveView {
    const recovery = this.#currency.kind === 'live' ? this.#recovery : freezeRecoveryCountdowns(this.#fieldState);
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
    const { snapshot } = normalizeRotation(view.payload.casa, view.payload.heroes);
    this.#rotation = snapshot;
    if (this.#currency.kind === 'live') {
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
    await this.#tap.teardown();
    this.#tap = this.#createTap((event) => {
      this.#handleTapEvent(event);
    });
    this.#tap.start();
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
