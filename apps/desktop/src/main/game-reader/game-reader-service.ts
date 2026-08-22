import type { BrowserWindow } from 'electron';
import type { AccountPayload, AccountView, GameSnapshotPayload, GameStatusInfo, IpcEventChannel } from '@bombfarm/contracts';
import { buildSnapshot } from '@bombfarm/game-data';
import { log } from '../logging.js';
import { buildFixtureAccountPayload } from './fixture-account.js';
import {
  buildFixtureSnapshot,
  loadFixtureBundle,
  rotateFixtureState,
} from './fixture-data.js';
import type { ScanTarget } from './memory-scanner.js';
import { MemoryScanner } from './memory-scanner.js';
import { findProcessId } from './process.js';

/** The subset of `AccountStore` the game reader needs to persist a fixture tick's payload. */
export interface AccountCommitter {
  commit(live: AccountPayload, opts: { gameRunning: boolean }): AccountView;
}

export type GameReaderMode = 'memory' | 'fixture';

export interface GameReaderConfig {
  mode: GameReaderMode;
  processName: string;
  pollAttachedMs: number;
  pollDetachedMs: number;
  relocateMs: number;
  staleRepeatThreshold: number;
}

const DEFAULT_CONFIG: GameReaderConfig = {
  mode: process.env.BFC_GAME_READER === 'fixture' ? 'fixture' : 'memory',
  processName: process.env.BFC_GAME_PROCESS ?? 'BombFarm.exe',
  pollAttachedMs: 50,
  pollDetachedMs: 10_000,
  relocateMs: 15_000,
  staleRepeatThreshold: 4,
};

export class GameReaderService {
  private readonly config: GameReaderConfig;
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

  private scanner: MemoryScanner | null = null;
  private target: ScanTarget | null = null;
  private lastHash: string | null = null;
  private repeatCount = 0;
  private lastRelocate = 0;
  private fixtureTick = 0;
  private fixtureBundle = loadFixtureBundle();
  /** Flipped once by `stop()`, never reset (until a hypothetical future `start()` re-arms it).
   * The explicit half of the shutdown-ordering contract: `clearTimeout` alone only stops a
   * tick that has not yet started firing — this flag additionally makes `tick()` a no-op for
   * any timer callback that was already in flight, so a tick can never reach
   * `accountStore.commit()` after `stop()` has run (see index.ts's `before-quit` handler,
   * which must call `stop()` before closing the account store). */
  private stopped = false;

  constructor(_userDataDir: string, config: Partial<GameReaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

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

  /** Injected once at boot (design §8, TD-8). Only fixture-mode ticks call `commit()` on it —
   * F3 has no memory-mode producer; F2 owns that call site. */
  setAccountStore(store: AccountCommitter): void {
    this.accountStore = store;
  }

  /** The most recently committed merged view, or `null` before any fixture tick has run. */
  getAccountView(): AccountView | null {
    return this.lastAccountView;
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
    this.scanner?.close();
    this.scanner = null;
  }

  getStatus(): GameStatusInfo {
    return this.status;
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
        this.tickMemory();
      }
    } catch (err) {
      log.error({ scope: 'game-reader', event: 'tick.failed', err });
      this.scanner?.close();
      this.scanner = null;
      this.target = null;
      this.updateStatus({
        status: 'stale',
        updatedAt: new Date().toISOString(),
        processName: this.config.processName,
      });
    }
  }

  private tickFixture(): void {
    this.fixtureTick += 1;
    const takenAt = new Date().toISOString();
    const state = rotateFixtureState(this.fixtureBundle.state, this.fixtureTick);
    const built = buildSnapshot({
      takenAt,
      source: 'live',
      state,
      inventory: this.fixtureBundle.inventory,
      heroRecords: this.fixtureBundle.heroRecords,
      heroEnergies: this.fixtureBundle.heroEnergies,
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
        inventory: this.fixtureBundle.inventory,
      },
    });

    if (this.accountStore) {
      this.lastAccountView = this.accountStore.commit(buildFixtureAccountPayload(takenAt), { gameRunning: true });
      this.onAccountCommitted?.();
    }
  }

  private tickMemory(): void {
    const pid = findProcessId(this.config.processName);
    if (!pid) {
      this.scanner?.close();
      this.scanner = null;
      this.target = null;
      this.updateStatus({
        status: 'not_running',
        updatedAt: new Date().toISOString(),
        processName: this.config.processName,
      });
      return;
    }

    if (!this.scanner) {
      this.scanner = new MemoryScanner(pid);
      if (!this.scanner.open()) {
        this.scanner = null;
        this.updateStatus({
          status: 'not_running',
          updatedAt: new Date().toISOString(),
          processName: this.config.processName,
        });
        return;
      }
      this.target = this.scanner.relocate(null);
      this.lastRelocate = Date.now();
      this.lastHash = null;
      this.repeatCount = 0;
    }

    if (!this.target) {
      this.target = this.scanner.relocate(null);
      this.lastRelocate = Date.now();
      if (!this.target) {
        this.updateStatus({
          status: 'stale',
          updatedAt: new Date().toISOString(),
          processName: this.config.processName,
          staleAgeMs: Date.now() - this.lastRelocate,
        });
        return;
      }
    }

    if (Date.now() - this.lastRelocate > this.config.relocateMs) {
      this.target = this.scanner.relocate(this.target);
      this.lastRelocate = Date.now();
      this.lastHash = null;
      this.repeatCount = 0;
    }

    if (!this.target) {
      return;
    }

    const read = this.scanner.readAt(this.target);
    if (!read.state) {
      this.target = this.scanner.relocate(this.target);
      this.lastRelocate = Date.now();
      this.updateStatus({
        status: 'stale',
        updatedAt: new Date().toISOString(),
        processName: this.config.processName,
        staleAgeMs: 0,
      });
      return;
    }

    if (read.hash && read.hash === this.lastHash) {
      this.repeatCount += 1;
      if (this.repeatCount >= this.config.staleRepeatThreshold) {
        this.target = this.scanner.relocate(this.target);
        this.lastRelocate = Date.now();
        this.lastHash = null;
        this.repeatCount = 0;
        this.updateStatus({
          status: 'stale',
          updatedAt: new Date().toISOString(),
          processName: this.config.processName,
          staleAgeMs: this.config.pollAttachedMs * this.config.staleRepeatThreshold,
        });
        return;
      }
    } else {
      this.repeatCount = 0;
      this.lastHash = read.hash;
    }

    const takenAt = new Date().toISOString();
    const built = buildSnapshot({
      takenAt,
      source: 'live',
      state: read.state,
      inventory: read.inventory,
    });

    this.updateStatus({
      status: read.suspectStale ? 'stale' : 'connected',
      updatedAt: takenAt,
      processName: this.config.processName,
      ...(read.suspectStale ? { staleAgeMs: 0 } : {}),
    });
    this.updateSnapshot({
      status: this.status,
      mapped: built.snapshot,
      raw: {
        state: read.state,
        inventory: read.inventory,
      },
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
