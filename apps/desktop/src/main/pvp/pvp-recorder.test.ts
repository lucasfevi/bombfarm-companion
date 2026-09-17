import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PvpHistoryResult } from '@bombfarm/contracts';
import { identifyObservedBody } from '@bombfarm/game-api';
import { createLogSpy, detectAvailableBindings, openTestAccountDb } from '../storage/test-support.js';
import { createPvpHistory } from './pvp-history.js';
import { createPvpRecorder } from './pvp-recorder.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const FIXTURE_PATH = resolve(__dirname, '..', 'live-source', 'fixtures', 'pvp-duels-offline.json');

function fixtureBodies(): readonly Buffer[] {
  const parsed = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as { bodies: unknown[] };
  return parsed.bodies.map((body) => Buffer.from(JSON.stringify(body), 'utf8'));
}

function observationOf(raw: Buffer, atMs: number) {
  const body: unknown = JSON.parse(raw.toString('utf8'));
  const verdict = identifyObservedBody(body);
  if (verdict.kind !== 'pvp') throw new Error(`fixture body is not a PVP body: ${verdict.kind}`);
  return { route: verdict.route, body, raw, atMs };
}

function openDb() {
  const binding = detectAvailableBindings()[0];
  if (!binding) throw new Error('no SQLite binding available in this environment — cannot run this suite');
  const db = openTestAccountDb(binding).db;
  if (!db) throw new Error('the test account database did not open');
  return db;
}

function openHistory() {
  return createPvpHistory(openDb());
}

describe('pvp recorder', () => {
  it('records the committed offline fixture: two duels (one with its film), the standing and the rank', () => {
    const history = openHistory();
    const emitted: PvpHistoryResult[] = [];
    const recorder = createPvpRecorder({ history, accountId: () => '486', emit: (view) => emitted.push(view) });

    const [result, film, filmless, state, ranking] = fixtureBodies();
    if (!result || !film || !filmless || !state || !ranking) throw new Error('fixture holds fewer than five bodies');
    recorder.observe(observationOf(result, 1_000));
    recorder.observe(observationOf(film, 2_000));
    recorder.observe(observationOf(filmless, 3_000));
    recorder.observe(observationOf(state, 4_000));
    recorder.observe(observationOf(ranking, 5_000));

    expect(emitted).toHaveLength(5);
    const view = history.list({ limit: 10 });
    expect(view.totals).toEqual({ duels: 2, won: 1, films: 1 });
    expect(view.standing).toMatchObject({ points: 113, tier: 'r3', tierFloor: 100, duelsUsed: 3, duelsMax: 5, slots: 5, slotsMax: 9, capturedAt: new Date(4_000).toISOString() });
    expect(view.standing?.squadHeroIds).toHaveLength(5);
    expect(view.rank).toEqual({ position: 12, points: 113, capturedAt: new Date(5_000).toISOString() });
    expect(view.rows.map((row) => [row.filmId, row.filmStored, row.won, row.accountId])).toEqual([
      [0, false, false, '486'],
      [48117, true, true, '486'],
    ]);
    expect(view.rows[1]?.recordedAt).toBe(new Date(1_000).toISOString());
  });

  it('keeps a film that passes before its result, and the row still finds it', () => {
    const history = openHistory();
    const recorder = createPvpRecorder({ history, accountId: () => null, emit: () => undefined });
    const [result, film] = fixtureBodies();
    if (!result || !film) throw new Error('fixture holds fewer than two bodies');

    recorder.observe(observationOf(film, 1_000));
    expect(history.list({ limit: 10 }).rows).toEqual([]);
    recorder.observe(observationOf(result, 2_000));
    expect(history.list({ limit: 10 }).rows[0]).toMatchObject({ filmId: 48117, filmStored: true });
  });

  it('keeps the film bytes as they came rather than re-serialising them', () => {
    const db = openDb();
    const recorder = createPvpRecorder({ history: createPvpHistory(db), accountId: () => null, emit: () => undefined });
    const raw = '{"id": 7, "fase": 3, "q": [{"t": 0.0}], "hz": 12.0}';
    recorder.observe(observationOf(Buffer.from(raw, 'utf8'), 1_000));
    const stored = db.prepare('SELECT body, frames FROM pvp_films WHERE film_id = ?').get(7) as { body: string; frames: number };
    expect(stored).toEqual({ body: raw, frames: 1 });
  });

  it('takes the standing a duel result carries, so the section is current before any poll', () => {
    const history = openHistory();
    const recorder = createPvpRecorder({ history, accountId: () => null, emit: () => undefined });
    const [result] = fixtureBodies();
    if (!result) throw new Error('fixture is empty');
    recorder.observe(observationOf(result, 1_000));
    expect(history.list({ limit: 10 }).standing).toMatchObject({ points: 123, tier: 'r3', capturedAt: new Date(1_000).toISOString() });
  });

  it('keeps a rank from the PVP points board only, never from the hero or power boards', () => {
    const history = openHistory();
    const emit = vi.fn();
    const recorder = createPvpRecorder({ history, accountId: () => null, emit });
    const [, , , , ranking] = fixtureBodies();
    if (!ranking) throw new Error('fixture holds no ranking');
    const other = JSON.parse(ranking.toString('utf8')) as Record<string, unknown>;
    other.by = 'hero';
    recorder.observe(observationOf(Buffer.from(JSON.stringify(other), 'utf8'), 1_000));
    expect(emit).not.toHaveBeenCalled();
    expect(history.list({ limit: 10 }).rank).toBeNull();
  });

  it('keeps one row for a result seen twice, though each sighting re-dates the standing it carries', () => {
    const history = openHistory();
    const emit = vi.fn();
    const recorder = createPvpRecorder({ history, accountId: () => null, emit });
    const [result] = fixtureBodies();
    if (!result) throw new Error('fixture is empty');
    recorder.observe(observationOf(result, 1_000));
    recorder.observe(observationOf(result, 2_000));
    const view = history.list({ limit: 10 });
    expect(view.totals.duels).toBe(1);
    expect(view.standing?.capturedAt).toBe(new Date(2_000).toISOString());
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('announces nothing for a film already held', () => {
    const history = openHistory();
    const emit = vi.fn();
    const recorder = createPvpRecorder({ history, accountId: () => null, emit });
    const [, film] = fixtureBodies();
    if (!film) throw new Error('fixture holds no film');
    recorder.observe(observationOf(film, 1_000));
    recorder.observe(observationOf(film, 2_000));
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('records a lost duel — a result that names no chest outcome, since none was issued', () => {
    const history = openHistory();
    const { log, records } = createLogSpy();
    const recorder = createPvpRecorder({ history, accountId: () => '486', emit: () => undefined, log });
    const [, , filmless] = fixtureBodies();
    if (!filmless) throw new Error('fixture holds no filmless duel');
    const lost = JSON.parse(filmless.toString('utf8')) as Record<string, unknown>;
    expect(lost).toMatchObject({ venceu: false });
    expect(lost).not.toHaveProperty('premio');

    recorder.observe(observationOf(filmless, 1_000));
    expect(records.map((entry) => entry.record.event)).toEqual(['duel.recorded']);
    expect(history.list({ limit: 10 }).rows[0]).toMatchObject({ won: false, prize: null, pointsBefore: 123, pointsAfter: 113 });
  });

  it('names an unreadable body in the log, with the record fields it lacked, and keeps nothing', () => {
    const history = openHistory();
    const { log, records } = createLogSpy();
    const emit = vi.fn();
    const recorder = createPvpRecorder({ history, accountId: () => null, emit, log });
    const raw = Buffer.from('{"venceu": true, "filme": 1}', 'utf8');
    recorder.observe({ route: 'duel', body: JSON.parse(raw.toString('utf8')), raw, atMs: 1_000 });
    const warned = records.find((entry) => entry.record.event === 'duel.unreadable');
    expect(warned?.record).toMatchObject({
      byteLength: raw.length,
      missing: ['phase', 'rooms', 'seconds', 'attacker', 'defender', 'pointsBefore', 'pointsAfter', 'duelsLeft', 'duelsMax', 'tier', 'tierFloor'],
    });
    expect(emit).not.toHaveBeenCalled();
    expect(history.list({ limit: 10 }).totals.duels).toBe(0);
  });
});
