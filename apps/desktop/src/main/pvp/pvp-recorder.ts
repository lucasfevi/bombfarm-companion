import type { PvpHistoryResult } from '@bombfarm/contracts';
import { parsePvpDuelResult, parsePvpFilm } from '@bombfarm/game-api';
import type { ObservedPvpBody } from '../live-source/live-source.js';
import type { LogPort } from '../storage/index.js';
import type { PvpHistory } from './pvp-history.js';

export interface PvpRecorderDeps {
  readonly history: PvpHistory;
  /** The account the app is bound to at the moment the body passes; the tap sees no request, so
   *  the body itself never says. */
  readonly accountId: () => string | null;
  readonly emit: (history: PvpHistoryResult) => void;
  readonly log?: LogPort;
  readonly listLimit?: number;
}

export interface PvpRecorder {
  observe(observation: ObservedPvpBody): void;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };
const DEFAULT_LIST_LIMIT = 50;

/**
 * Keeps what the tap saw. A result is a row on its own — a duel whose film never arrives (the
 * player skipped the battle, the server issued none, the tap missed it) is still a duel fought —
 * and a film is kept the moment it passes, whichever order the two land in: the server answers
 * 404 for a film seconds after the client pulls it, so there is no second chance at one.
 */
export function createPvpRecorder(deps: PvpRecorderDeps): PvpRecorder {
  const log = deps.log ?? NOOP_LOG;
  const limit = deps.listLimit ?? DEFAULT_LIST_LIMIT;

  function announce(): void {
    deps.emit(deps.history.list({ limit }));
  }

  return {
    observe({ route, body, raw, atMs }) {
      const at = new Date(atMs).toISOString();
      if (route === 'duel') {
        const record = parsePvpDuelResult(body);
        if (record === null) {
          log.warn({ scope: 'pvp', event: 'duel.unreadable', byteLength: raw.length });
          return;
        }
        const written = deps.history.recordDuel(record, { recordedAt: at, accountId: deps.accountId() });
        log.info({ scope: 'pvp', event: written ? 'duel.recorded' : 'duel.already_held', filmId: record.filmId, won: record.won });
        if (written) announce();
        return;
      }

      const summary = parsePvpFilm(body);
      if (summary === null) {
        log.warn({ scope: 'pvp', event: 'film.unreadable', byteLength: raw.length });
        return;
      }
      const written = deps.history.storeFilm(summary, raw.toString('utf8'), { storedAt: at });
      log.info({
        scope: 'pvp',
        event: written ? 'film.stored' : 'film.already_held',
        filmId: summary.filmId,
        frames: summary.frames,
        byteLength: raw.length,
      });
      if (written) announce();
    },
  };
}
