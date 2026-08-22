import type { BrowserWindow } from 'electron';
import type {
  AccountPayload,
  AccountView,
  GameSnapshotPayload,
  GameStatusInfo,
  IpcEventChannel,
  LiveCurrency,
  LiveTick,
} from '@bombfarm/contracts';
import { isLiveCurrency } from '@bombfarm/contracts';
import { buildSnapshot } from '@bombfarm/game-data';
import { tickToRawGameState } from '../live-source/tick-to-raw-state.js';
import { log } from '../logging.js';
import { buildFixtureAccountPayload } from './fixture-account.js';
import type { FixtureBundle } from './fixture-data.js';
import {
  buildFixtureSnapshot,
  loadFixtureBundle,
  rotateFixtureState,
} from './fixture-data.js';
import { findProcessId } from './process.js';

/** The subset of `AccountStore` the game reader needs to persist a fixture tick's payload. */
export interface AccountCommitter {
  commit(live: AccountPayload, opts: { gameRunning: boolean }): AccountView;
}

export type GameReaderMode = 'live' | 'fixture';

export interface GameReaderConfig {
  mode: GameReaderMode;
  processName: string;
  pollAttachedMs: number;
  pollDetachedMs: number;
}

const DEFAULT_CONFIG: Omit<GameReaderConfig, 'mode'> = {
  processName: process.env.BFC_GAME_PROCESS ?? 'BombFarm.exe',
  pollAttachedMs: 50,
  pollDetachedMs: 10_000,
};

/** A packaged install must be structurally unable to select fixture mode — an inherited or
 * stale `BFC_GAME_READER=fixture` env var (a shell, a CI harness, a support machine) would
 * otherwise make a real install report itself `connected` and then throw on every tick. */
function resolveDefaultMode(isPackaged: boolean): GameReaderMode {
  return !isPackaged && process.env.BFC_GAME_READER === 'fixture' ? 'fixture' : 'live';
}

function ageMsSince(sinceAtIso: string | undefined, nowMs: number): number | undefined {
  if (!sinceAtIso) return undefined;
  const since = Date.parse(sinceAtIso);
  return Number.isNaN(since) ? undefined : Math.max(0, nowMs - since);
}

export class GameReaderService {
  private readonly config: GameReaderConfig;
  private readonly isPackaged: boolean;
  private status: GameStatusInfo;
  private payload: GameSnapshotPayload;
  private timer: NodeJS.Timeout | null = null;
  private windowProvider: (() => BrowserWindow | null) | null = null;
  private accountStore: AccountCommitter | null = null;
  private lastAccountView: AccountView | null = null;
  /** MP3 F3 (`AD-043` point 3) — fired after `tickFixture` commits, so a caller sees the FRESH
   * `lastAccountView` through `getAccountView()`, never the previous tick's (a callback invoked
   * from inside `commit()` itself would read the stale value one tick early — see
   * `account-view.ts`'s notifier doc comment for why). Optional and unset in production; only
   * fixture mode ever calls `accountStore.commit()` from this class at all. */
  onAccountCommitted?: () => void;

  /** The most recent frame the live tap has delivered, via `ingestLiveTick()`. The tap is
   *  push-based and this class's own `tick()` is a poll loop, so a tick that lands between two
   *  tap frames reports this cached one rather than blocking on a fresh one — and `null` until
   *  the first frame arrives is exactly the "nothing to show yet" case `tickLive()` reports
   *  honestly rather than inventing a snapshot for. */
  private latestLiveTick: { tick: LiveTick; takenAt: string } | null = null;
  /** The live tap's own read on whether it is currently delivering, via `ingestLiveCurrency()`.
   *  `latestLiveTick` only ever grows staler by itself — nothing here expires it on age — so
   *  `tickLive()` cannot tell a frozen tap from a live one by looking at the cached tick alone.
   *  This is the same silence watch the tap already runs (attach loss, a hook gone quiet, the
   *  client no longer streaming): reusing it here means `tickLive()` degrades honestly the
   *  moment the tap itself reports a gap, instead of replaying the last frame as `connected`
   *  forever. */
  private latestLiveCurrency: LiveCurrency | null = null;
  /** `takenAt` of the `latestLiveTick` frame `tickLive()` last ran the adapt+build chain on.
   *  The tap's frame cadence is far coarser than `pollAttachedMs`, so most polls see the exact
   *  same cached frame; re-running `tickToRawGameState()`/`buildSnapshot()` on byte-identical
   *  input every ~50ms just to discover nothing changed is wasted work `tickLive()` now skips. */
  private lastProcessedFrameAt: string | null = null;
  private fixtureTick = 0;
  private fixtureBundle: FixtureBundle | null = null;
  /** Flipped once by `stop()`, never reset (until a hypothetical future `start()` re-arms it).
   * The explicit half of the shutdown-ordering contract: `clearTimeout` alone only stops a
   * tick that has not yet started firing — this flag additionally makes `tick()` a no-op for
   * any timer callback that was already in flight, so a tick can never reach
   * `accountStore.commit()` after `stop()` has run (see index.ts's `before-quit` handler,
   * which must call `stop()` before closing the account store). */
  private stopped = false;

  constructor(
    _userDataDir: string,
    config: Partial<GameReaderConfig> = {},
    deps: { isPackaged?: boolean } = {},
  ) {
    this.isPackaged = deps.isPackaged ?? false;
    const mode = config.mode ?? resolveDefaultMode(this.isPackaged);
    this.config = { ...DEFAULT_CONFIG, ...config, mode };

    // Never restore `status` from disk (design R-2 / APS-03): a cold boot with the game
    // closed always reports `not_running`, never a previous session's `connected`.
    const now = new Date().toISOString();
    this.status = {
      status: this.config.mode === 'fixture' ? 'connected' : 'not_running',
      updatedAt: now,
      processName: this.config.processName,
    };
    this.payload = {
      status: this.status,
      mapped: null,
      raw: { state: null, inventory: null },
    } satisfies GameSnapshotPayload;
  }

  setWindowProvider(provider: () => BrowserWindow | null): void {
    this.windowProvider = provider;
  }

  /** Injected once at boot. Only fixture-mode ticks call `commit()` on it — the live path has
   * no account-data producer of its own, because account data comes from the authenticated
   * read path instead. */
  setAccountStore(store: AccountCommitter): void {
    this.accountStore = store;
  }

  /** The most recently committed merged view, or `null` before any fixture tick has run. */
  getAccountView(): AccountView | null {
    return this.lastAccountView;
  }

  /** Called by index.ts for every frame the live tap's `LiveSource` publishes. Cheap and
   *  synchronous — it only caches the frame for the next poll `tick()` to pick up, it never
   *  reaches `accountStore.commit()` (account data is sourced from the authenticated route,
   *  never from here). */
  ingestLiveTick(tick: LiveTick, takenAt: string = new Date().toISOString()): void {
    this.latestLiveTick = { tick, takenAt };
  }

  /** Called by index.ts for every currency transition the live tap publishes — `live` once a
   *  frame has been proven, `gap` the moment the tap loses that proof (attach lost, hook gone
   *  quiet, client no longer streaming). `tickLive()` trusts this over the mere presence of a
   *  cached tick, so a stalled tap is reported honestly instead of replaying its last frame. */
  ingestLiveCurrency(currency: LiveCurrency): void {
    this.latestLiveCurrency = currency;
  }

  start(): void {
    if (this.timer) return;
    // Re-arm the shutdown latch in case this instance is ever stopped and started again —
    // there is no such call site today, but `start()` should not stay permanently inert after
    // a `stop()` if one is ever added.
    this.stopped = false;
    if (this.config.mode === 'fixture') {
      this.tick();
    }
    this.scheduleNext(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getStatus(): GameStatusInfo {
    return this.status;
  }

  getMode(): GameReaderMode {
    return this.config.mode;
  }

  getSnapshot(): GameSnapshotPayload {
    return this.payload;
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.tick();
      const interval =
        this.status.status === 'connected' ? this.config.pollAttachedMs : this.config.pollDetachedMs;
      this.scheduleNext(interval);
    }, delayMs);
  }

  private tick(): void {
    // Belt-and-braces half of the shutdown-ordering fix: `stop()` already clears the pending
    // timer, so this only matters for a callback that had already begun running (or, on some
    // platforms, one that still fires despite `clearTimeout`) — it must never reach
    // `accountStore.commit()` once shutdown has started (root cause of the fixture-mode
    // "database is not open" uncaught exception on quit).
    if (this.stopped) return;
    try {
      if (this.config.mode === 'fixture') {
        this.tickFixture();
      } else {
        this.tickLive();
      }
    } catch (err) {
      log.error({ scope: 'game-reader', event: 'tick.failed', err });
      this.latestLiveTick = null;
      this.updateStatus({
        status: 'stale',
        updatedAt: new Date().toISOString(),
        processName: this.config.processName,
      });
    }
  }

  /** Only fixture mode ever reaches this — a non-fixture run must never touch the filesystem
   * for these (dev/CI-only) fixtures, let alone throw if they are not resolvable, as a packaged
   * install's would not be. Loaded at most once per instance; `tickFixture()` runs on a fast
   * poll and must not re-read the fixture files on every tick. */
  private getFixtureBundle(): FixtureBundle {
    this.fixtureBundle ??= loadFixtureBundle();
    return this.fixtureBundle;
  }

  private tickFixture(): void {
    this.fixtureTick += 1;
    const takenAt = new Date().toISOString();
    const fixtures = this.getFixtureBundle();
    const state = rotateFixtureState(fixtures.state, this.fixtureTick);
    const built = buildSnapshot({
      takenAt,
      source: 'live',
      state,
      inventory: fixtures.inventory,
      heroRecords: fixtures.heroRecords,
      heroEnergies: fixtures.heroEnergies,
    });

    this.updateStatus({
      status: 'connected',
      updatedAt: takenAt,
      processName: 'fixture',
    });
    this.updateSnapshot({
      status: this.status,
      mapped: built.snapshot,
      raw: {
        state,
        inventory: fixtures.inventory,
      },
    });

    if (this.accountStore) {
      this.lastAccountView = this.accountStore.commit(buildFixtureAccountPayload(takenAt, this.isPackaged), {
        gameRunning: true,
      });
      this.onAccountCommitted?.();
    }
  }

  /**
   * The non-fixture path. Status comes from real process detection (`findProcessId`) — it is
   * never inferred from whether a live-tap frame has arrived, since the tap can lag attach by a
   * few polls and reporting `not_running` for that gap would be dishonest. The snapshot channel,
   * separately, reflects whatever the live tap has delivered through `ingestLiveTick()` — this
   * never fabricates a reading of its own; with no frame yet, or once the tap's own currency
   * says it has stopped delivering (`ingestLiveCurrency()`), it reports `stale` and leaves the
   * previous snapshot in place rather than replaying a frozen one as `connected`.
   */
  private tickLive(): void {
    const pid = findProcessId(this.config.processName);
    if (!pid) {
      this.latestLiveTick = null;
      this.lastProcessedFrameAt = null;
      this.updateStatus({
        status: 'not_running',
        updatedAt: new Date().toISOString(),
        processName: this.config.processName,
      });
      return;
    }

    if (!this.latestLiveTick || !this.latestLiveCurrency || !isLiveCurrency(this.latestLiveCurrency)) {
      const staleAgeMs = ageMsSince(
        this.latestLiveCurrency?.kind === 'gap' ? this.latestLiveCurrency.sinceAt : undefined,
        Date.now(),
      );
      this.updateStatus({
        status: 'stale',
        updatedAt: new Date().toISOString(),
        processName: this.config.processName,
        ...(staleAgeMs !== undefined ? { staleAgeMs } : {}),
      });
      return;
    }

    const takenAt = this.latestLiveTick.takenAt;
    if (takenAt === this.lastProcessedFrameAt) {
      this.updateStatus({
        status: 'connected',
        updatedAt: takenAt,
        processName: this.config.processName,
      });
      return;
    }

    const raw = tickToRawGameState(this.latestLiveTick.tick);
    if (!raw) {
      const staleAgeMs = ageMsSince(takenAt, Date.now());
      this.updateStatus({
        status: 'stale',
        updatedAt: new Date().toISOString(),
        processName: this.config.processName,
        ...(staleAgeMs !== undefined ? { staleAgeMs } : {}),
      });
      return;
    }

    const built = buildSnapshot({ takenAt, source: 'live', state: raw });
    this.lastProcessedFrameAt = takenAt;

    this.updateStatus({
      status: 'connected',
      updatedAt: takenAt,
      processName: this.config.processName,
    });
    this.updateSnapshot({
      status: this.status,
      mapped: built.snapshot,
      raw: { state: raw, inventory: null },
    });
  }

  /**
   * `updatedAt` is when this status was read, not part of what the status *is* — every poll
   * carries a fresh one, so comparing the whole object made every poll a "change" and pushed a
   * status event at the poll interval forever. The renderer applies each push into state above
   * the planning tree, so that alone recommitted the whole window ~20 times a second. Compare
   * only the fields a consumer can act on; `this.status` still carries the new timestamp for
   * anyone who asks for it.
   */
  private updateStatus(next: GameStatusInfo): void {
    const changed =
      next.status !== this.status.status ||
      next.staleAgeMs !== this.status.staleAgeMs ||
      next.processName !== this.status.processName;
    this.status = next;
    this.payload = { ...this.payload, status: next };
    if (changed) {
      this.emit('game:status', next);
    }
  }

  private updateSnapshot(next: GameSnapshotPayload): void {
    const changed = JSON.stringify(next.raw) !== JSON.stringify(this.payload.raw);
    this.payload = next;
    if (changed) {
      this.emit('snapshot:updated', next);
    }
  }

  private emit(channel: 'game:status', payload: GameStatusInfo): void;
  private emit(channel: 'snapshot:updated', payload: GameSnapshotPayload): void;
  private emit(channel: IpcEventChannel, payload: GameStatusInfo | GameSnapshotPayload): void {
    const window = this.windowProvider?.();
    window?.webContents.send(`bfc:event:${channel}`, payload);
    log.debug({ scope: 'game-reader', event: channel });
  }
}

export function createInitialFixturePayload(): GameSnapshotPayload {
  const takenAt = new Date().toISOString();
  const built = buildFixtureSnapshot(takenAt);
  const fixtures = loadFixtureBundle();
  return {
    status: {
      status: 'connected',
      updatedAt: takenAt,
      processName: 'fixture',
    },
    mapped: built.snapshot,
    raw: {
      state: fixtures.state,
      inventory: fixtures.inventory,
    },
  };
}
