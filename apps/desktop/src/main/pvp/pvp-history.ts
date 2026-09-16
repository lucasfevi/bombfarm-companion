import {
  EMPTY_PVP_HISTORY,
  type PvpDuelPrize,
  type PvpDuelRecord,
  type PvpDuelRow,
  type PvpFilmSummary,
  type PvpHistoryResult,
} from '@bombfarm/contracts';
import type { LogPort, SqliteDb } from '../storage/index.js';

/**
 * Every duel the tap has seen settle, and every film it caught, over the same database the account
 * store opens — the forge ledger borrows that handle the same way. Both tables are additive
 * (`CREATE TABLE IF NOT EXISTS` beside the account tables), so `SCHEMA_VERSION` does not move: that
 * version only refuses a file written by a newer build, and an older build simply never reads
 * these tables.
 *
 * Two tables, not one, because the two bodies arrive separately and in no guaranteed order: a
 * player who skips the battle animation may never pull the film at all, the tap may miss one
 * body and catch the other, and a film could in principle land before its result. A duel is a row
 * the moment its result passes; a film is a row the moment it passes; the join at read time says
 * whether a duel's film is held. A duel's key is its film id where the server issued one, and
 * otherwise the figures the result carried (see {@link duelKeyOf}), so a result body seen twice —
 * re-sent by the client, or replayed by the offline fixture on every launch — is one row.
 */
export const INIT_PVP_SQL = `
CREATE TABLE IF NOT EXISTS pvp_duels (
  id             INTEGER PRIMARY KEY,
  recorded_at    TEXT NOT NULL,
  account_id     TEXT,
  duel_key       TEXT NOT NULL UNIQUE,
  film_id        INTEGER,
  won            INTEGER NOT NULL,
  phase          INTEGER NOT NULL,
  rooms          INTEGER NOT NULL,
  seconds        INTEGER NOT NULL,
  attacker_name  TEXT NOT NULL,
  attacker_heroes INTEGER NOT NULL,
  attacker_score INTEGER NOT NULL,
  defender_name  TEXT NOT NULL,
  defender_heroes INTEGER NOT NULL,
  defender_score INTEGER NOT NULL,
  points_before  INTEGER NOT NULL,
  points_after   INTEGER NOT NULL,
  duels_left     INTEGER NOT NULL,
  duels_max      INTEGER NOT NULL,
  prize          TEXT NOT NULL,
  tier           TEXT NOT NULL,
  tier_floor     INTEGER NOT NULL,
  squad_hero_ids TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pvp_films (
  film_id      INTEGER PRIMARY KEY,
  stored_at    TEXT NOT NULL,
  phase        INTEGER NOT NULL,
  visual_phase INTEGER NOT NULL,
  hz           INTEGER NOT NULL,
  seconds      INTEGER NOT NULL,
  rooms        INTEGER NOT NULL,
  frames       INTEGER NOT NULL,
  body         TEXT NOT NULL
);
`;

const LIST_SQL = `
SELECT d.*, (f.film_id IS NOT NULL) AS film_stored
FROM pvp_duels d LEFT JOIN pvp_films f ON f.film_id = d.film_id
ORDER BY d.id DESC LIMIT ?
`;

const TOTALS_SQL = `
SELECT COUNT(*) AS duels, SUM(won) AS won,
  (SELECT COUNT(*) FROM pvp_films f WHERE f.film_id IN (SELECT film_id FROM pvp_duels)) AS films
FROM pvp_duels
`;

export interface PvpHistory {
  /** `true` when a row was written; `false` for a result already held (by {@link duelKeyOf}) or
   *  with no store behind it. */
  recordDuel(record: PvpDuelRecord, opts: { readonly recordedAt: string; readonly accountId: string | null }): boolean;
  /** `true` when the film was written; a film already held is left as first stored. */
  storeFilm(summary: PvpFilmSummary, body: string, opts: { readonly storedAt: string }): boolean;
  list(opts: { readonly limit: number }): PvpHistoryResult;
}

interface StoredRow {
  id: number;
  recorded_at: string;
  account_id: string | null;
  film_id: number | null;
  won: number;
  phase: number;
  rooms: number;
  seconds: number;
  attacker_name: string;
  attacker_heroes: number;
  attacker_score: number;
  defender_name: string;
  defender_heroes: number;
  defender_score: number;
  points_before: number;
  points_after: number;
  duels_left: number;
  duels_max: number;
  prize: string;
  tier: string;
  tier_floor: number;
  squad_hero_ids: string;
  film_stored: number;
}

interface TotalsRow {
  duels: number;
  won: number | null;
  films: number | null;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

function squadHeroIdsFrom(stored: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function toRow(stored: StoredRow): PvpDuelRow {
  return {
    id: stored.id,
    recordedAt: stored.recorded_at,
    accountId: stored.account_id,
    filmStored: stored.film_stored === 1,
    won: stored.won === 1,
    phase: stored.phase,
    filmId: stored.film_id ?? 0,
    rooms: stored.rooms,
    seconds: stored.seconds,
    attacker: { name: stored.attacker_name, heroes: stored.attacker_heroes, score: stored.attacker_score },
    defender: { name: stored.defender_name, heroes: stored.defender_heroes, score: stored.defender_score },
    pointsBefore: stored.points_before,
    pointsAfter: stored.points_after,
    duelsLeft: stored.duels_left,
    duelsMax: stored.duels_max,
    prize: stored.prize as PvpDuelPrize,
    tier: stored.tier,
    tierFloor: stored.tier_floor,
    squadHeroIds: squadHeroIdsFrom(stored.squad_hero_ids),
  };
}

/**
 * A filmed duel is its film id. A filmless one has no id of its own, so its key is the figures no
 * two consecutive duels share: the points it moved between, the opponent, both scores and the
 * room — a duel always moves the points, so the next one starts where this one ended.
 */
export function duelKeyOf(record: PvpDuelRecord): string {
  if (record.filmId > 0) return `film:${String(record.filmId)}`;
  return [
    'nofilm',
    String(record.pointsBefore),
    String(record.pointsAfter),
    record.defender.name,
    String(record.attacker.score),
    String(record.defender.score),
    String(record.phase),
  ].join(':');
}

/** Both bindings answer `run()` with the statement's change count under the same key. */
function wrote(runResult: unknown): boolean {
  const changes = (runResult as { changes?: unknown } | null)?.changes;
  return typeof changes === 'number' ? changes > 0 : typeof changes === 'bigint' ? changes > 0n : false;
}

export function createPvpHistory(db: SqliteDb | null, log: LogPort = NOOP_LOG): PvpHistory {
  if (db) {
    try {
      db.exec(INIT_PVP_SQL);
    } catch (err) {
      log.error({ scope: 'pvp', event: 'history.init_failed', error: String(err) });
    }
  }

  return {
    recordDuel(record, { recordedAt, accountId }) {
      if (!db) return false;
      try {
        const result = db.prepare(
          'INSERT INTO pvp_duels (recorded_at, account_id, duel_key, film_id, won, phase, rooms, seconds, ' +
            'attacker_name, attacker_heroes, attacker_score, defender_name, defender_heroes, defender_score, ' +
            'points_before, points_after, duels_left, duels_max, prize, tier, tier_floor, squad_hero_ids) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(duel_key) DO NOTHING',
        ).run(
          recordedAt,
          accountId,
          duelKeyOf(record),
          record.filmId > 0 ? record.filmId : null,
          record.won ? 1 : 0,
          record.phase,
          record.rooms,
          record.seconds,
          record.attacker.name,
          record.attacker.heroes,
          record.attacker.score,
          record.defender.name,
          record.defender.heroes,
          record.defender.score,
          record.pointsBefore,
          record.pointsAfter,
          record.duelsLeft,
          record.duelsMax,
          record.prize,
          record.tier,
          record.tierFloor,
          JSON.stringify(record.squadHeroIds),
        );
        return wrote(result);
      } catch (err) {
        log.error({ scope: 'pvp', event: 'history.record_failed', error: String(err) });
        return false;
      }
    },

    storeFilm(summary, body, { storedAt }) {
      if (!db) return false;
      try {
        const result = db.prepare(
          'INSERT INTO pvp_films (film_id, stored_at, phase, visual_phase, hz, seconds, rooms, frames, body) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(film_id) DO NOTHING',
        ).run(
          summary.filmId,
          storedAt,
          summary.phase,
          summary.visualPhase,
          summary.hz,
          summary.seconds,
          summary.rooms,
          summary.frames,
          body,
        );
        return wrote(result);
      } catch (err) {
        log.error({ scope: 'pvp', event: 'history.store_film_failed', error: String(err) });
        return false;
      }
    },

    list({ limit }) {
      if (!db) return EMPTY_PVP_HISTORY;
      try {
        const rows = db
          .prepare(LIST_SQL)
          .all(limit) as StoredRow[];
        const totals = db
          .prepare(TOTALS_SQL)
          .get() as TotalsRow | undefined;
        return {
          rows: rows.map(toRow),
          totals: { duels: totals?.duels ?? 0, won: totals?.won ?? 0, films: totals?.films ?? 0 },
        };
      } catch (err) {
        log.error({ scope: 'pvp', event: 'history.list_failed', error: String(err) });
        return EMPTY_PVP_HISTORY;
      }
    },
  };
}
