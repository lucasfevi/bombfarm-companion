import { closeSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import type {
  AccountSection,
  AccountView,
  AppFlavor,
  FieldCountdown,
  FieldDrop,
  LiveCurrency,
  LiveDiagnosticsDumpOutcome,
  LiveEarnings,
  LiveEvent,
  LiveHeroEnergy,
  LiveTick,
  LiveTickHero,
  LiveView,
  RotationSnapshot,
  SectionFidelity,
} from '@bombfarm/contracts';
import { isConnectedCurrency, isLiveCurrency, liveGap } from '@bombfarm/contracts';
import { identifyObservedBody, isPlainObject, normalizeRotation } from '@bombfarm/game-api';
import {
  advanceRecoveryClock,
  createInitialFieldCountdownState,
  extractRosterHeroAbilities,
  ingestFieldCountdownTick,
  resolveFieldDrainMultipliers,
  type DrainDisagreementReport,
  type DrainMultipliers,
  type FieldCountdownState,
  type RosterHeroAbilities,
} from '@bombfarm/domain/live';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { xpPerProp } from '@bombfarm/domain/phase-wiki';
import { runPowerShellAsync, runPowerShellSync, stripExeSuffix } from '../game-reader/process.js';
import { EarningsFold } from './earnings-fold.js';
import { createFrameCapture, readFrameCaptureEnabledFromEnv } from './frame-capture.js';
import { FrameRing } from './frame-ring.js';
import type { LogPort } from './log-port.js';
import { MapFold, type MapAccountBoosts, type MapWikiFacts } from './map-fold.js';
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

function compareHeroEnergy(a: LiveHeroEnergy, b: LiveHeroEnergy): number {
  return a.heroId < b.heroId ? -1 : a.heroId > b.heroId ? 1 : 0;
}

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

/** `ROUTES` reads `/roster` before `/rotation`, and the five fail independently — so a cycle that
 *  loses only its roster still commits a rotation body, with no roster beside it. */
function carriesRoster(rosterRaw: unknown): boolean {
  return Array.isArray(rosterRaw) && rosterRaw.length > 0;
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

/** The background checker's only output: the law and the independently observed rate disagreed
 *  by more than its margin. Never drives the display — see `ingestFieldCountdownTick`'s own doc
 *  comment for why the check exists at all. */
function reportDrainDisagreements(log: LogPort, disagreements: readonly DrainDisagreementReport[]): void {
  for (const disagreement of disagreements) {
    log.warn({
      scope: 'live-source',
      event: 'drain.rate_disagreement',
      heroId: disagreement.heroId,
      observedDrainPerSecond: disagreement.observedDrainPerSecond,
      modelledDrainPerSecond: disagreement.modelledDrainPerSecond,
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
  /** Gates the frame capture alongside {@link LiveSourceDeps.flavor}, and defaults to `true`
   *  because an omission must disable the capture rather than enable it — a packaged artifact can
   *  carry the `dev` flavor, so flavor alone does not answer this. */
  readonly isPackaged?: boolean;
  readonly processName?: string;
  readonly log?: LogPort;
  readonly now?: () => number;
  /** Test seam: overrides how the underlying attach mechanism is built. Production leaves this
   *  unset and gets a real tap wired against this machine's process list and instrumentation
   *  runtime. */
  readonly createTap?: (
    onEvent: (event: LiveEvent) => void,
    onHttpBody: (body: Buffer, atMs: number) => void,
  ) => TapHandle;
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
  readonly isPackaged: boolean;
  readonly log: LogPort;
  readonly ring: FrameRing;
}): (onEvent: (event: LiveEvent) => void, onHttpBody: (body: Buffer, atMs: number) => void) => TapHandle {
  const ring = deps.ring;

  const capture = createFrameCapture({
    isPackaged: deps.isPackaged,
    flavor: deps.flavor,
    enabled: readFrameCaptureEnabledFromEnv(process.env),
    maxBytes: FRAME_CAPTURE_MAX_BYTES,
    appendPort: nodeFrameCaptureAppendPort(path.join(deps.userDataDir, 'live-frame-capture.bin')),
    log: deps.log,
  });

  return (onEvent, onHttpBody) => {
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
      onHttpBody,
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

/**
 * The one adapter between the live map fold and the planner's own wiki math — the same
 * `computePhaseIntelGlobal` the web planner's Phases screen reads, so a figure shown on the Live
 * tab and the same figure on the Phases screen cannot drift into two different numbers.
 *
 * `xpPerPropActual` and `weightedAvgGoldActual` are the boost-applied variants; their `*Wiki`
 * siblings are the unboosted base and are deliberately not what a player-facing panel shows.
 */
function wikiFactsFor(phase: number, boosts: MapAccountBoosts): MapWikiFacts | null {
  const intel = computePhaseIntelGlobal(phase, { teamCoinPct: boosts.teamCoinPct, xpMult: boosts.xpMult });
  if (!intel) return null;
  return {
    propsTotal: intel.propCount,
    economy: {
      xpPerProp: intel.xpPerPropActual,
      averageGoldPerProp: intel.weightedAvgGoldActual,
      averageGoldPerClear: intel.totalMapGoldActual,
    },
  };
}

/** `skills.totals.coin_add` as PERCENTAGE POINTS, the unit `computePhaseIntelGlobal` takes —
 *  the same `* 100` conversion, and the same `team_coin_add` fallback name, that the planner's own
 *  save import applies to this field. */
function readTeamCoinPct(skills: Record<string, unknown> | undefined): number | undefined {
  if (!isPlainObject(skills)) return undefined;
  const totals = skills.totals;
  if (!isPlainObject(totals)) return undefined;
  const value = totals.coin_add ?? totals.team_coin_add;
  return typeof value === 'number' && Number.isFinite(value) ? value * 100 : undefined;
}

/** `skills.totals.xp_mult` is present even on a read where `casa` did not resolve — the same
 *  per-section fidelity `import-save.ts` notes for reading its own field-slots figure off `skills`
 *  rather than `casa` — so it is read unconditionally, never gated on the rotation fold below. */
function readXpMult(skills: Record<string, unknown> | undefined): number | undefined {
  if (!isPlainObject(skills)) return undefined;
  const totals = skills.totals;
  if (!isPlainObject(totals)) return undefined;
  const value = totals.xp_mult;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** `/state`'s gold, the same digit-string wire encoding `tls-stream.ts`'s `readWireMoney` parses —
 *  a non-numeric value is ignored rather than becoming `NaN`. */
function readAccountGold(account: Record<string, unknown> | undefined): number | undefined {
  if (!isPlainObject(account)) return undefined;
  const value = account.gold;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readSectionCapturedAt(fidelity: SectionFidelity | undefined): string | undefined {
  return fidelity && fidelity.status !== 'missing' ? fidelity.capturedAt : undefined;
}

export class LiveSource {
  readonly #log: LogPort;
  readonly #now: () => number;
  readonly #createTap: (
    onEvent: (event: LiveEvent) => void,
    onHttpBody: (body: Buffer, atMs: number) => void,
  ) => TapHandle;
  /** `null` under the `createTap` test seam, which bypasses the default factory and therefore
   *  never owns a ring of its own. */
  readonly #ring: FrameRing | null;

  #tap: TapHandle;
  #listeners: Array<(event: LiveEvent) => void> = [];

  #currency: LiveCurrency;
  #rotation: RotationSnapshot | null = null;
  /** When the currently-applied {@link #rotation} was captured — self-fetched or tap-observed,
   *  compared by this value alone so whichever is newer wins regardless of which method happened
   *  to be called second. */
  #rotationAtMs: number | null = null;
  /** The `/roster` heroes array from the most recent self-fetched read, reused to join name/grade
   *  onto a tap-observed rotation body — which arrives with no roster of its own — so an observed
   *  update does not blank names the app already knows. */
  #lastRosterRaw: unknown = undefined;
  /** Extracted alongside {@link #lastRosterRaw} from the same self-fetched read, keyed by id — the
   *  source `#ingestTick` reads each tick to resolve real per-hero {@link DrainMultipliers} for
   *  whoever the tap reports on the field, since a tap frame alone carries no ability ranks. Ability
   *  ranks only — never the full save-parse `HeroRecord`, which main may not build. */
  #rosterHeroById: ReadonlyMap<string, RosterHeroAbilities> = new Map();
  #fieldState: FieldCountdownState = createInitialFieldCountdownState();
  #field: readonly FieldCountdown[] = [];
  /** The on-field half of the fast channel's energy readings — observed on the most recent tick.
   *  The recovering half is not cached beside it: like `recovery` itself it advances on the
   *  server's clock rather than on frame arrival, so `getView()` derives it per call. */
  #fieldEnergies: readonly LiveHeroEnergy[] = [];
  #updatedAt: string;

  readonly #earningsFold: EarningsFold;
  readonly #mapFold: MapFold;
  /** `null` until the first tap frame of the session has been folded — {@link LiveView.earnings}
   *  stays `null` until then too, rather than reporting a rate computed over zero real ticks. */
  #goldBalance: number | null = null;
  /** The most recent stored `/state` gold reading — {@link #buildEarnings} falls back to this
   *  whenever no live tick has ever set {@link #goldBalance} this session, so a game-closed read
   *  shows a real (if aging) balance instead of an em dash. */
  #accountGoldBalance: number | null = null;
  /** When {@link #accountGoldBalance} was captured. `null` only alongside a `null` balance. */
  #accountGoldCapturedAt: string | null = null;
  #earningsStarted = false;
  /** The last `skills.totals.xp_mult` seen from {@link ingestRotation}, sticky across a read that
   *  omits the section — never reset to `undefined` just because one read's fidelity was partial. */
  #xpMult: number | undefined;
  /** The last `skills.totals.coin_add` seen, sticky across a partial read for the same reason
   *  {@link #xpMult} is. */
  #teamCoinPct: number | undefined;
  /** `undefined` means no binding has been observed yet, the state a `null` read from the store
   *  must never be mistaken for — see {@link #trackAccountBinding}. */
  #lastBinding: string | undefined;

  constructor(deps: LiveSourceDeps) {
    this.#log = deps.log ?? NOOP_LOG_PORT;
    this.#now = deps.now ?? Date.now;
    this.#earningsFold = new EarningsFold({ now: this.#now, xpPerProp, log: this.#log });
    this.#mapFold = new MapFold({ wikiFactsFor });
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
        isPackaged: deps.isPackaged ?? true,
        log: this.#log,
        ring,
      });
    }
    this.#currency = liveGap('neverAttached', this.#nowIso());
    this.#updatedAt = this.#nowIso();
    this.#tap = this.#createTap(
      (event) => {
        this.#handleTapEvent(event);
      },
      (body, atMs) => {
        this.#handleObservedHttpBody(body, atMs);
      },
    );
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

  /** Recovery runs on the server's own clock, not on combat frames, so it is advanced here — on
   *  every call, not only when a new frame or rotation read arrives — rather than cached alongside
   *  `#field`. See {@link advanceRecoveryClock} for what `connected` decides. */
  getView(): LiveView {
    const connected = isConnectedCurrency(this.#currency);
    const { state, recovery, energies: recoveryEnergies } = advanceRecoveryClock(this.#fieldState, this.#now(), connected);
    this.#fieldState = state;
    return {
      currency: this.#currency,
      field: this.#field,
      recovery,
      // No hero is on the field and recovering at once, so the two halves never collide on a
      // heroId; the sort is what makes the merged list comparable against the last published one.
      energies: [...this.#fieldEnergies, ...recoveryEnergies].sort(compareHeroEnergy),
      rotation: this.#rotation,
      onFieldHeroIds: this.#fieldState.onFieldHeroIdsSorted,
      earnings: this.#buildEarnings(),
      map: this.#mapFold.current,
      updatedAt: this.#updatedAt,
    };
  }

  #buildEarnings(): LiveEarnings | null {
    if (!this.#earningsStarted && this.#accountGoldBalance === null) return null;
    return {
      goldBalance: this.#goldBalance ?? this.#accountGoldBalance,
      goldBalanceCapturedAt: this.#goldBalance === null ? this.#accountGoldCapturedAt : null,
      gold10: this.#earningsFold.gold10,
      goldSession: this.#earningsFold.goldSession,
      xp10: this.#earningsFold.xp10,
      xpSession: this.#earningsFold.xpSession,
      goldSessionTotal: this.#earningsFold.goldSessionTotal,
      xpSessionTotal: this.#earningsFold.xpSessionTotal,
      gold10Series: this.#earningsFold.gold10Series,
      goldPerProp10: this.#earningsFold.goldPerProp10,
      propsPerMinute10: this.#earningsFold.propsPerMinute10,
      propsSessionTotal: this.#earningsFold.propsSessionTotal,
      coverageSeconds: this.#earningsFold.coverageSeconds,
      sessionSeconds: this.#earningsFold.sessionSeconds,
    };
  }

  /** The renderer holds no session accumulators of its own — this is the one place they can be
   *  zeroed, so the reset control can never drift from the figures it resets. The rolling 10-minute
   *  window is untouched: see {@link EarningsFold.reset}. */
  resetEarnings(): void {
    this.#earningsFold.reset('reset');
  }

  /** The REST rotation projection: the base view every countdown falls back to when no live tap
   *  frame is available. Left untouched (never set to an empty snapshot) until a `/rotation` read
   *  actually resolves, so {@link LiveView.rotation} stays `null` rather than lying about having
   *  seen an account with no heroes. `atMs` defaults to "now" — a self-fetched read is applied at
   *  the moment this app finished reading it — but is overridable so a caller can prove the
   *  newest-wins rule against {@link ingestObservedRotation} deterministically. */
  ingestRotation(view: AccountView, atMs: number = this.#now()): void {
    this.#xpMult = readXpMult(view.payload.skills) ?? this.#xpMult;
    this.#teamCoinPct = readTeamCoinPct(view.payload.skills) ?? this.#teamCoinPct;
    this.#mapFold.setAccountBoosts({ xpMult: this.#xpMult ?? 1, teamCoinPct: this.#teamCoinPct ?? 0 });
    this.#trackAccountBinding(view.store.binding);
    const accountGold = readAccountGold(view.payload.account);
    if (accountGold !== undefined) {
      this.#accountGoldBalance = accountGold;
      this.#accountGoldCapturedAt = readSectionCapturedAt(view.payload.fidelity?.account) ?? null;
    }
    if (view.payload.casa === undefined) return;
    const rosterHeroAbilities = extractRosterHeroAbilities(view.payload.heroes);
    this.#applyRotationBody(view.payload.casa, atMs, { rosterRaw: view.payload.heroes, rosterHeroAbilities });
  }

  /** A `null` binding is transient (the store between reads, not a different account) and must
   *  never overwrite the last real one or itself count as a change. The first real binding this
   *  session ever sees is not a change either — only a later, *different* one is. */
  #trackAccountBinding(binding: string | null): void {
    if (binding === null) return;
    if (this.#lastBinding !== undefined && binding !== this.#lastBinding) {
      this.#earningsFold.reset('accountChange');
      // Only the stream-derived half is dropped. The boosts were read from THIS call's payload,
      // a few lines above — they already belong to the new account, and clearing them here would
      // report the map's economy at no boost at all until the next rotation read landed. Same
      // reasoning that leaves `#xpMult` alone across an account change.
      this.#mapFold.reset();
    }
    this.#lastBinding = binding;
  }

  /** The tap-observed counterpart to {@link ingestRotation} — same fold, a body identified from
   *  the client's own traffic instead of a request this app made. `atMs` decides which of the two
   *  wins when both are current: whichever timestamp is newer, never whichever call happened
   *  second. */
  ingestObservedRotation(body: unknown, atMs: number): void {
    this.#applyRotationBody(body, atMs);
  }

  /** `selfFetched`, when present, carries the read's own `/roster` array (plus the ability ranks
   *  extracted from it) — assigned to {@link #lastRosterRaw} / {@link #rosterHeroById} only on this
   *  same branch, below the staleness check, so a read rejected as older than what is already
   *  applied never overwrites either. The three halves of one read are accepted or rejected
   *  together. */
  #applyRotationBody(
    body: unknown,
    atMs: number,
    selfFetched?: { readonly rosterRaw: unknown; readonly rosterHeroAbilities: readonly RosterHeroAbilities[] },
  ): void {
    if (this.#rotationAtMs !== null && atMs < this.#rotationAtMs) {
      this.#log.info({ scope: 'live-source', event: 'rotation.stale_ignored', atMs, appliedAtMs: this.#rotationAtMs });
      return;
    }
    this.#rotationAtMs = atMs;
    if (selfFetched && carriesRoster(selfFetched.rosterRaw)) {
      this.#lastRosterRaw = selfFetched.rosterRaw;
      this.#rosterHeroById = new Map(selfFetched.rosterHeroAbilities.map((hero) => [hero.id, hero]));
    }
    const { snapshot, drops } = normalizeRotation(body, this.#lastRosterRaw);
    reportRotationDrops(this.#log, drops);
    this.#rotation = snapshot;
    // Frames only arrive while a battle is running, so an attached tap sitting on a menu reports
    // `live` and produces nothing. Keying this on the currency alone left the panel with a perfectly
    // good snapshot and no countdowns at all; what must not be overwritten is measured frame data
    // that actually exists, which is what `#field` being non-empty means.
    if (isLiveCurrency(this.#currency) && this.#field.length > 0) {
      this.#touch();
      return;
    }
    this.#ingestTick({ heroes: fieldHeroesFromRotation(snapshot) }, this.#now(), 'rest');
  }

  /** Reads the client's own traffic before this app's own requests: {@link identifyObservedBody}
   *  is the strict, shape-only discriminator (the tap sees responses with no URL, so a path is
   *  never available to identify by) — a match resolves to exactly one route or not at all, never
   *  a guess. Only the rotation route is wired downstream this slice; every other identified
   *  section is named in the log and otherwise left alone, the seam the next one plugs into. */
  #handleObservedHttpBody(bodyBuf: Buffer, atMs: number): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyBuf.toString('utf8'));
    } catch {
      this.#log.warn({ scope: 'live-source', event: 'observed_body.malformed_json', byteLength: bodyBuf.length });
      return;
    }

    const identification = identifyObservedBody(parsed);
    if (identification.kind === 'unidentified') {
      this.#log.warn({ scope: 'live-source', event: 'observed_body.unidentified', byteLength: bodyBuf.length });
      return;
    }
    if (identification.kind === 'ambiguous') {
      this.#log.warn({
        scope: 'live-source',
        event: 'observed_body.ambiguous',
        sections: identification.sections,
        byteLength: bodyBuf.length,
      });
      return;
    }

    this.#log.info({
      scope: 'live-source',
      event: 'observed_body.identified',
      section: identification.section,
      byteLength: bodyBuf.length,
    });
    this.#dispatchObservedBody(identification.section, parsed, atMs);
  }

  #dispatchObservedBody(section: AccountSection, body: unknown, atMs: number): void {
    switch (section) {
      case 'casa':
        this.ingestObservedRotation(body, atMs);
        return;
      case 'account':
      case 'heroes':
      case 'skills':
      case 'items':
        return;
      default: {
        const exhaustive: never = section;
        return exhaustive;
      }
    }
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
      this.#tap = this.#createTap(
        (event) => {
          this.#handleTapEvent(event);
        },
        (body, atMs) => {
          this.#handleObservedHttpBody(body, atMs);
        },
      );
      this.#tap.start();
    }
  }

  async teardown(): Promise<void> {
    await this.#tap.teardown();
  }

  // The tap itself only ever raises 'frame' or 'currency' — 'fastUpdate' is a channel this class's
  // own consumers publish downstream (see live-fast-publisher.ts), never one the tap produces —
  // so the branch below is exhaustive over what can actually arrive here.
  #handleTapEvent(event: LiveEvent): void {
    if (event.type === 'currency') {
      this.#currency = event.currency;
      this.#touch();
    } else if (event.type === 'frame') {
      this.#earningsFold.consumeTick(event.frame.tick, event.frame.sequence, this.#xpMult);
      this.#mapFold.consumeTick(event.frame.tick, event.frame.sequence);
      this.#earningsStarted = true;
      if (event.frame.tick.gold !== undefined) this.#goldBalance = event.frame.tick.gold;
      this.#ingestTick(event.frame.tick, Date.parse(event.frame.at));
    }
    this.#publish(event);
  }

  #ingestTick(tick: LiveTick, atMs: number, sampleSource: 'tap' | 'rest' = 'tap'): void {
    const onFieldHeroes: RosterHeroAbilities[] = [];
    for (const heroOnField of tick.heroes) {
      const hero = this.#rosterHeroById.get(heroOnField.id);
      if (hero !== undefined) onFieldHeroes.push(hero);
    }
    const modelledDrainMultipliers: ReadonlyMap<string, DrainMultipliers> = resolveFieldDrainMultipliers(onFieldHeroes);

    const result = ingestFieldCountdownTick(this.#fieldState, {
      tick,
      rotation: this.#rotation,
      atMs,
      modelledDrainMultipliers,
      sampleSource,
    });
    this.#fieldState = result.state;
    this.#field = result.field;
    this.#fieldEnergies = result.energies;
    reportDrainDisagreements(this.#log, result.disagreements);
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
