import {
  EMPTY_PVP_HISTORY,
  type PvpDuelPrize,
  type PvpDuelRecord,
  type PvpDuelRow,
  type PvpFilmSummary,
  type PvpHistoryResult,
  type PvpRank,
  type PvpStanding,
  type PvpStateSnapshot,
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

CREATE TABLE IF NOT EXISTS pvp_standing (
  key         TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  body        TEXT NOT NULL
);
`;

/** The two rows `pvp_standing` holds: the account's PVP state as last reported, and its position
 *  on the points board as last fetched. Newest wins; there is no history of either. */
const STANDING_KEY = 'state';
const RANK_KEY = 'rank';

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
  /** Replaces the standing with a newer report, dating it; `false` only with no store behind it. */
  recordStanding(snapshot: PvpStateSnapshot, opts: { readonly capturedAt: string }): boolean;
  recordRank(rank: Omit<PvpRank, 'capturedAt'>, opts: { readonly capturedAt: string }): boolean;
  list(opts: { readonly limit: number }): PvpHistoryResult;
  /** The film's body as the tap caught it � the ~2 MB stays in main. `null` when not held. */
  readFilm(filmId: number): string | null;
}

interface StandingRow {
  captured_at: string;
  body: string;
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

function readStanding(db: SqliteDb, key: string): StandingRow | undefined {
  return db.prepare('SELECT captured_at, body FROM pvp_standing WHERE key = ?').get(key) as StandingRow | undefined;
}

/** Always rewritten, figures unchanged or not: the date beside the standing means "last read",
 *  and a report that repeats the last one is still a read — a player who sees "as of 8h ago" on
 *  a figure the app confirmed a minute ago reads it as stale. */
function writeStanding(db: SqliteDb, key: string, capturedAt: string, body: unknown): void {
  db.prepare(
    'INSERT INTO pvp_standing (key, captured_at, body) VALUES (?, ?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET captured_at = excluded.captured_at, body = excluded.body',
  ).run(key, capturedAt, JSON.stringify(body));
}

function standingOf(row: StandingRow | undefined): PvpStanding | null {
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.body) as PvpStateSnapshot;
    return { ...parsed, capturedAt: row.captured_at };
  } catch {
    return null;
  }
}

function rankOf(row: StandingRow | undefined): PvpRank | null {
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.body) as Omit<PvpRank, 'capturedAt'>;
    return { ...parsed, capturedAt: row.captured_at };
  } catch {
    return null;
  }
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

    recordStanding(snapshot, { capturedAt }) {
      if (!db) return false;
      try {
        writeStanding(db, STANDING_KEY, capturedAt, snapshot);
        return true;
      } catch (err) {
        log.error({ scope: 'pvp', event: 'history.record_standing_failed', error: String(err) });
        return false;
      }
    },

    recordRank(rank, { capturedAt }) {
      if (!db) return false;
      try {
        writeStanding(db, RANK_KEY, capturedAt, rank);
        return true;
      } catch (err) {
        log.error({ scope: 'pvp', event: 'history.record_rank_failed', error: String(err) });
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
          standing: standingOf(readStanding(db, STANDING_KEY)),
          rank: rankOf(readStanding(db, RANK_KEY)),
        };
      } catch (err) {
        log.error({ scope: 'pvp', event: 'history.list_failed', error: String(err) });
        return EMPTY_PVP_HISTORY;
      }
    },

    readFilm(filmId) {
      if (!db) return null;
      try {
        const stored = db.prepare('SELECT body FROM pvp_films WHERE film_id = ?').get(filmId) as { body: string } | undefined;
        return stored?.body ?? null;
      } catch (err) {
        log.error({ scope: 'pvp', event: 'history.read_film_failed', error: String(err) });
        return null;
      }
    },
  };
}
