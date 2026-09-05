import { findProcessIdAsync, isProcessAlive } from '../game-reader/process.js';
import {
  POLL_INTERVAL_MS,
  applyEnabledChange,
  createInitialKeepAliveState,
  recordAskFailure,
  tickKeepAlive,
  type KeepAliveState,
} from './keep-alive.js';
import type { SteamAskOutcome } from './steam-launch.js';

export interface GameKeepAliveClock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimeout: (handle: NodeJS.Timeout) => void;
}

export interface GameKeepAliveDeps {
  clock: GameKeepAliveClock;
  processPresent: () => Promise<boolean>;
  askSteam: () => Promise<SteamAskOutcome>;
  log?: (event: string, detail?: Record<string, unknown>) => void;
  platform?: NodeJS.Platform;
  pollIntervalMs?: number;
}

export interface GameKeepAlive {
  start: () => void;
  stop: () => void;
  setEnabled: (enabled: boolean) => void;
}

const DEFAULT_GAME_PROCESS_NAME = 'BombFarm.exe';

export function createGameKeepAlive(deps: GameKeepAliveDeps): GameKeepAlive {
  const pollIntervalMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const platform = deps.platform ?? process.platform;
  const log = (event: string, detail?: Record<string, unknown>) => deps.log?.(event, detail);

  let state: KeepAliveState = createInitialKeepAliveState();
  let enabled = false;
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  function schedule(): void {
    if (!running) return;
    timer = deps.clock.setTimeout(() => {
      void poll();
    }, pollIntervalMs);
  }

  async function ask(): Promise<void> {
    let outcome: SteamAskOutcome | 'error';
    try {
      outcome = await deps.askSteam();
    } catch {
      outcome = 'error';
    }

    if (outcome === 'asked') {
      log('keep_alive.asked');
      return;
    }

    // Anything but 'asked' means no game is coming, so the launch wait the core armed would be
    // 90s of watching for a process nobody started. Arm the backoff now instead.
    log(outcome === 'updating' ? 'keep_alive.skip_updating' : 'keep_alive.ask_failed', { outcome });
    state = recordAskFailure(state, deps.clock.now());
  }

  async function poll(): Promise<void> {
    timer = null;
    try {
      const processPresent = await deps.processPresent();
      if (!running) return;

      const wasAsked = state.inFlightSinceMs !== null;
      const tick = tickKeepAlive(state, { nowMs: deps.clock.now(), enabled, processPresent });
      state = tick.state;

      if (processPresent && wasAsked) {
        log('keep_alive.recovered');
      }
      if (tick.action === 'ask-steam') {
        await ask();
      }
    } finally {
      schedule();
    }
  }

  return {
    start: () => {
      if (platform !== 'win32' || running) return;
      running = true;
      schedule();
    },
    stop: () => {
      running = false;
      if (timer !== null) {
        deps.clock.clearTimeout(timer);
        timer = null;
      }
    },
    setEnabled: (next: boolean) => {
      enabled = next;
      state = applyEnabledChange(state, next, deps.clock.now());
    },
  };
}

export function createProcessPresencePort(processName?: string): () => Promise<boolean> {
  let lastPid: number | null = null;

  return async () => {
    if (lastPid !== null && isProcessAlive(lastPid)) {
      return true;
    }

    lastPid = await findProcessIdAsync(processName ?? process.env.BFC_GAME_PROCESS ?? DEFAULT_GAME_PROCESS_NAME);
    return lastPid !== null;
  };
}
