import { beforeAll, describe, expect, it } from 'vitest';
import { EMPTY_PVP_HISTORY, type PvpDuelRecord, type PvpFilmSummary } from '@bombfarm/contracts';
import { SCHEMA_VERSION } from '../storage/account-schema.js';
import type { SqliteBinding } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createPvpHistory, duelKeyOf } from './pvp-history.js';

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

function firstBinding(): SqliteBinding {
  const binding = AVAILABLE_BINDINGS[0];
  if (!binding) throw new Error('no SQLite binding available in this environment — cannot run this suite');
  return binding;
}

function duel(overrides: Partial<PvpDuelRecord> = {}): PvpDuelRecord {
  return {
    won: true,
    phase: 120,
    filmId: 48117,
    rooms: 3,
    seconds: 60,
    attacker: { name: 'Player', heroes: 5, score: 184320 },
    defender: { name: 'Opponent', heroes: 4, score: 151960 },
    pointsBefore: 118,
    pointsAfter: 123,
    duelsLeft: 3,
    duelsMax: 5,
    prize: 'won',
    tier: 'r3',
    tierFloor: 100,
    squadHeroIds: ['h1', 'h2'],
    ...overrides,
  };
}

function film(overrides: Partial<PvpFilmSummary> = {}): PvpFilmSummary {
  return { filmId: 48117, phase: 120, visualPhase: 51, hz: 12, seconds: 60, rooms: 3, frames: 721, ...overrides };
}

const AT = { recordedAt: '2026-09-16T10:00:00.000Z', accountId: '486' };

describe('pvp history', () => {
  it('creates its tables beside the account tables without moving the schema version', () => {
    const open = openTestAccountDb(firstBinding());
    createPvpHistory(open.db);
    const stored = open.db?.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    expect(stored?.value).toBe(String(SCHEMA_VERSION));
    const tables = open.db
      ?.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('pvp_duels', 'pvp_films') ORDER BY name")
      .all();
    expect(tables).toEqual([{ name: 'pvp_duels' }, { name: 'pvp_films' }]);
  });

  it('lists newest first, round-trips every column, and says whether each film is held', () => {
    const open = openTestAccountDb(firstBinding());
    const history = createPvpHistory(open.db);
    expect(history.recordDuel(duel(), AT)).toBe(true);
    expect(history.storeFilm(film(), '{"q":[]}', { storedAt: '2026-09-16T10:00:01.000Z' })).toBe(true);
    expect(
      history.recordDuel(
        duel({ filmId: 0, won: false, prize: 'lost', defender: { name: 'Other', heroes: 5, score: 90 } }),
        { recordedAt: '2026-09-16T10:05:00.000Z', accountId: null },
      ),
    ).toBe(true);

    const listed = history.list({ limit: 10 });
    expect(listed.rows.map((row) => row.filmId)).toEqual([0, 48117]);
    expect(listed.rows[1]).toEqual({ id: 1, ...AT, filmStored: true, ...duel() });
    expect(listed.rows[0]).toMatchObject({ id: 2, accountId: null, filmStored: false, won: false, prize: 'lost' });
    expect(listed.totals).toEqual({ duels: 2, won: 1, films: 1 });

    expect(history.list({ limit: 1 }).rows).toHaveLength(1);
  });

  it('keeps one row per issued film id, however many times the result body passes', () => {
    const open = openTestAccountDb(firstBinding());
    const history = createPvpHistory(open.db);
    expect(history.recordDuel(duel(), AT)).toBe(true);
    expect(history.recordDuel(duel(), AT)).toBe(false);
    expect(history.list({ limit: 10 }).totals.duels).toBe(1);
  });

  it('keeps a filmless duel once per set of figures: a re-sent result is one row, the next duel is another', () => {
    const open = openTestAccountDb(firstBinding());
    const history = createPvpHistory(open.db);
    expect(history.recordDuel(duel({ filmId: 0 }), AT)).toBe(true);
    expect(history.recordDuel(duel({ filmId: 0 }), { recordedAt: '2026-09-16T10:00:09.000Z', accountId: '486' })).toBe(false);
    expect(history.recordDuel(duel({ filmId: 0, pointsBefore: 123, pointsAfter: 128 }), AT)).toBe(true);
    expect(history.list({ limit: 10 }).totals).toEqual({ duels: 2, won: 2, films: 0 });
  });

  it('keys a duel by its film id when it has one, and by its figures when it does not', () => {
    expect(duelKeyOf(duel())).toBe('film:48117');
    expect(duelKeyOf(duel({ filmId: 0 }))).toBe('nofilm:118:123:Opponent:184320:151960:120');
  });

  it('attaches a film that lands before its result, and leaves a film already held untouched', () => {
    const open = openTestAccountDb(firstBinding());
    const history = createPvpHistory(open.db);
    expect(history.storeFilm(film(), '{"first":true}', { storedAt: '2026-09-16T09:59:59.000Z' })).toBe(true);
    expect(history.storeFilm(film(), '{"second":true}', { storedAt: '2026-09-16T10:00:00.000Z' })).toBe(false);
    expect(history.list({ limit: 10 }).totals.films).toBe(0);

    history.recordDuel(duel(), AT);
    const listed = history.list({ limit: 10 });
    expect(listed.rows[0]?.filmStored).toBe(true);
    expect(listed.totals.films).toBe(1);
    const stored = open.db?.prepare('SELECT body FROM pvp_films WHERE film_id = ?').get(48117) as { body: string } | undefined;
    expect(stored?.body).toBe('{"first":true}');
  });

  it('is inert without a database', () => {
    const history = createPvpHistory(null);
    expect(history.recordDuel(duel(), AT)).toBe(false);
    expect(history.storeFilm(film(), '{}', { storedAt: AT.recordedAt })).toBe(false);
    expect(history.list({ limit: 10 })).toEqual(EMPTY_PVP_HISTORY);
  });
});
