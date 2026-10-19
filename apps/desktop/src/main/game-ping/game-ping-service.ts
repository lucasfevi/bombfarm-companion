import { GAME_PING_CHECK_MS, emptyGamePingView, type GamePingView } from '@bombfarm/contracts';
import type { LogPort } from '../storage/index.js';
import type { GamePingProbe } from './game-ping-transport.js';

export interface GamePingServiceDeps {
  ping: GamePingProbe;
  log: LogPort;
  onChanged?(view: GamePingView): void;
  scheduler?: { readonly setTimeout: typeof setTimeout; readonly clearTimeout: typeof clearTimeout };
  checkEveryMs?: number;
}

export interface GamePingService {
  start(): void;
  stop(): void;
  getView(): GamePingView;
}

export function createGamePingService(deps: GamePingServiceDeps): GamePingService {
  const setTimeoutFn = deps.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.scheduler?.clearTimeout ?? clearTimeout;
  const checkEveryMs = deps.checkEveryMs ?? GAME_PING_CHECK_MS;

  let shown: GamePingView = emptyGamePingView;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;
  let failing = false;

  function show(latencyMs: number | null): void {
    if (latencyMs === shown.latencyMs) return;
    shown = { latencyMs };
    deps.onChanged?.(shown);
  }

  async function check(): Promise<void> {
    try {
      const latencyMs = await deps.ping();
      failing = false;
      show(latencyMs);
    } catch (error: unknown) {
      if (!failing) deps.log.warn({ scope: 'game-ping', event: 'check.failed', error: String(error) });
      failing = true;
      show(null);
    }
  }

  function schedule(): void {
    if (stopped) return;
    timer = setTimeoutFn(() => {
      timer = null;
      void check().finally(schedule);
    }, checkEveryMs);
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      void check().finally(schedule);
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimeoutFn(timer);
      timer = null;
    },
    getView: () => shown,
  };
}
