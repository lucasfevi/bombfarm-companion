import type { BrowserWindow } from 'electron';
import type { GameSnapshotPayload, GameStatusInfo, IpcEventChannel } from '@bombfarm/contracts';
import { buildSnapshot } from '@bombfarm/game-data';
import { log } from '../logging.js';
import {
  buildFixtureSnapshot,
  loadFixtureBundle,
  rotateFixtureState,
} from './fixture-data.js';
import type { ScanTarget } from './memory-scanner.js';
import { MemoryScanner } from './memory-scanner.js';
import { findProcessId } from './process.js';
import { SnapshotStore } from './snapshot-store.js';

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
  private readonly store: SnapshotStore;
  private status: GameStatusInfo;
  private payload: GameSnapshotPayload;
  private timer: NodeJS.Timeout | null = null;
  private windowProvider: (() => BrowserWindow | null) | null = null;

  private scanner: MemoryScanner | null = null;
  private target: ScanTarget | null = null;
  private lastHash: string | null = null;
  private repeatCount = 0;
  private lastRelocate = 0;
  private fixtureTick = 0;
  private fixtureBundle = loadFixtureBundle();

  constructor(userDataDir: string, config: Partial<GameReaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = new SnapshotStore(userDataDir);
    this.store.load();

    const restored = this.store.get();
    const now = new Date().toISOString();
    this.status = restored?.status ?? {
      status: this.config.mode === 'fixture' ? 'connected' : 'not_running',
      updatedAt: now,
      processName: this.config.processName,
    };
    this.payload =
      restored ??
      ({
        status: this.status,
        mapped: null,
        raw: { state: null, inventory: null },
      } satisfies GameSnapshotPayload);
  }

  setWindowProvider(provider: () => BrowserWindow | null): void {
    this.windowProvider = provider;
  }

  start(): void {
    if (this.timer) return;
    if (this.config.mode === 'fixture') {
      this.tickFixture();
    }
    this.scheduleNext(0);
  }

  stop(): void {
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
    if (this.config.mode === 'fixture') {
      this.tickFixture();
      return;
    }
    try {
      this.tickMemory();
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

  private updateStatus(next: GameStatusInfo): void {
    const changed = JSON.stringify(next) !== JSON.stringify(this.status);
    this.status = next;
    this.payload = { ...this.payload, status: next };
    if (changed) {
      this.emit('game:status', next);
    }
  }

  private updateSnapshot(next: GameSnapshotPayload): void {
    const changed = JSON.stringify(next.raw) !== JSON.stringify(this.payload.raw);
    this.payload = next;
    if (next.mapped) {
      this.store.save(next);
    }
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
