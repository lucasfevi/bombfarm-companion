import {
  emptyOnlinePlayersView,
  ONLINE_PLAYERS_CHECK_MS,
  ONLINE_PLAYERS_MAX_AGE_MS,
  readOnlinePlayersBody,
  type OnlinePlayersReading,
  type OnlinePlayersView,
} from '@bombfarm/contracts';
import type { LogPort } from '../storage/index.js';
import type { OnlinePlayersHttpGet } from './online-players-transport.js';

export interface OnlinePlayersServiceDeps {
  httpGet: OnlinePlayersHttpGet;
  log: LogPort;
  now(): number;
  onChanged?(view: OnlinePlayersView): void;
  scheduler?: { readonly setTimeout: typeof setTimeout; readonly clearTimeout: typeof clearTimeout };
  checkEveryMs?: number;
}

export interface OnlinePlayersService {
  start(): void;
  stop(): void;
  getView(): OnlinePlayersView;
}

export function createOnlinePlayersService(deps: OnlinePlayersServiceDeps): OnlinePlayersService {
  const setTimeoutFn = deps.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.scheduler?.clearTimeout ?? clearTimeout;
  const checkEveryMs = deps.checkEveryMs ?? ONLINE_PLAYERS_CHECK_MS;

  let held: OnlinePlayersReading | null = null;
  let shown: OnlinePlayersView = emptyOnlinePlayersView;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;

  function viewNow(): OnlinePlayersView {
    if (held === null) return emptyOnlinePlayersView;
    const ageMs = deps.now() - held.at * 1000;
    return ageMs > ONLINE_PLAYERS_MAX_AGE_MS ? emptyOnlinePlayersView : { reading: held };
  }

  function settle(): void {
    const next = viewNow();
    const same = next.reading?.at === shown.reading?.at && next.reading?.players === shown.reading?.players;
    if (same) return;
    shown = next;
    deps.onChanged?.(shown);
  }

  async function check(): Promise<void> {
    try {
      const response = await deps.httpGet();
      if (response.status !== 200) {
        deps.log.warn({ scope: 'online-players', event: 'check.refused', status: response.status });
      } else {
        const reading = readOnlinePlayersBody(parseJson(response.body));
        if (reading === null) deps.log.warn({ scope: 'online-players', event: 'check.malformed' });
        else held = reading;
      }
    } catch (error: unknown) {
      deps.log.warn({ scope: 'online-players', event: 'check.failed', error: String(error) });
    }
    settle();
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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
