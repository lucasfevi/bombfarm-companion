/**
 * The alarm's own proof. Each check is asserted twice: green against a healthy snapshot, red
 * against a snapshot broken in exactly one way — because a monitor never observed failing has
 * not been verified.
 */
import { describe, expect, it } from 'vitest';

import {
  MAX_AGE_HOURS,
  SNAPSHOT_URL,
  checkPublishedSnapshot,
  evaluateSnapshot,
  renderSummary,
} from './freshness.mjs';

const NOW_MS = Date.parse('2026-09-01T12:00:00.000Z');
const MS_PER_HOUR = 3_600_000;

const generatedHoursAgo = (hours) => new Date(NOW_MS - hours * MS_PER_HOUR).toISOString();

const entryReadHoursAgo = (hours) => ({
  key: 'ember_luva#2',
  fetchedUtc: generatedHoursAgo(hours),
});

function snapshotBody(overrides = {}) {
  return JSON.stringify({
    schemaVersion: 3,
    generatedUtc: generatedHoursAgo(1),
    entries: [entryReadHoursAgo(1)],
    coverage: { marketRows: 1, keyedRows: 1, matchedCatalogKeys: 1, catalogKeys: 1440 },
    ...overrides,
  });
}

const evaluate = (overrides) =>
  evaluateSnapshot({ status: 200, body: snapshotBody(overrides), nowMs: NOW_MS });

describe('the published snapshot alarm', () => {
  it('passes a snapshot that is current, populated and matched', () => {
    const result = evaluate();
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails a stale timestamp, and says how long rather than guessing why', () => {
    expect(evaluate({ generatedUtc: generatedHoursAgo(MAX_AGE_HOURS - 0.5) }).ok).toBe(true);

    const stale = evaluate({ generatedUtc: generatedHoursAgo(MAX_AGE_HOURS + 3.2) });
    expect(stale.ok).toBe(false);
    expect(stale.failures).toEqual([
      `the published snapshot has not advanced in 6.2 hours (threshold ${MAX_AGE_HOURS})`,
    ]);
  });

  it('fails a timestamp it cannot read at all', () => {
    expect(evaluate({ generatedUtc: 'whenever' }).failures).toEqual([
      'the published snapshot carries no readable generatedUtc',
    ]);
    expect(evaluate({ generatedUtc: undefined }).failures).toEqual([
      'the published snapshot carries no readable generatedUtc',
    ]);
  });

  it('fails an empty entries array', () => {
    const empty = evaluate({ entries: [] });
    expect(empty.ok).toBe(false);
    expect(empty.failures).toEqual(['the published snapshot carries no entries']);
  });

  it('fails a fresh, valid, useless snapshot — the witnessed shape', () => {
    const useless = evaluate({
      coverage: { marketRows: 99, keyedRows: 99, matchedCatalogKeys: 0, catalogKeys: 1440 },
    });
    expect(useless.ok).toBe(false);
    expect(useless.failures).toEqual([
      'the published snapshot matches no catalog key, so nothing owned can be priced from it',
    ]);
  });

  /**
   * The witnessed shape, and the reason this check is pointed at the rows rather than at the file:
   * a pass whose enumeration reached nothing republishes the rows it already had, which advances
   * `generatedUtc` while nothing in the file has been read since.
   */
  it('fails a fresh, populated, matched snapshot that has stopped reading anything', () => {
    const carriedForward = evaluate({
      generatedUtc: generatedHoursAgo(0.1),
      entries: [entryReadHoursAgo(MAX_AGE_HOURS + 1.4), entryReadHoursAgo(MAX_AGE_HOURS + 9)],
    });

    expect(carriedForward.ok).toBe(false);
    expect(carriedForward.failures).toEqual([
      `the published snapshot has read nothing in 4.4 hours (threshold ${MAX_AGE_HOURS}), so it is carrying old rows forward`,
    ]);
  });

  it('dates the file by its freshest reading, not its oldest', () => {
    const mixed = evaluate({
      entries: [entryReadHoursAgo(MAX_AGE_HOURS + 40), entryReadHoursAgo(2)],
    });
    expect(mixed.ok).toBe(true);
    expect(mixed.readingAgeHours).toBe(2);
  });

  /**
   * A snapshot with no per-row timestamp leaves this check nothing to assert on, so it fails
   * rather than passing: a monitor whose subject is absent is not a monitor that is satisfied.
   */
  it('fails a snapshot in which nothing carries a readable reading timestamp', () => {
    expect(evaluate({ entries: [{ key: 'ember_luva#2', fetchedUtc: null }] }).failures).toEqual([
      'the published snapshot carries no entry it can date at all',
    ]);
    expect(evaluate({ entries: [{ key: 'ember_luva#2' }] }).failures).toEqual([
      'the published snapshot carries no entry it can date at all',
    ]);
    // A native quote is not a substitute: it left the published file when quoting left the sweep.
    expect(
      evaluate({ entries: [{ key: 'ember_luva#2', nativeQuotedUtc: generatedHoursAgo(0.1) }] })
        .failures,
    ).toEqual(['the published snapshot carries no entry it can date at all']);
  });

  it('says nothing about reading age when there are no entries at all', () => {
    expect(evaluate({ entries: [] }).failures).toEqual([
      'the published snapshot carries no entries',
    ]);
  });

  it('fails a body that is not JSON, without claiming anything about its contents', () => {
    const garbage = evaluateSnapshot({ status: 200, body: '<!DOCTYPE html>', nowMs: NOW_MS });
    expect(garbage.ok).toBe(false);
    expect(garbage.failures).toEqual(['the published snapshot is not valid JSON']);
  });

  it('fails a non-200, and never inspects the body it did not get', () => {
    const missing = evaluateSnapshot({ status: 404, body: 'Not Found', nowMs: NOW_MS });
    expect(missing.ok).toBe(false);
    expect(missing.failures).toEqual(['the published snapshot could not be fetched: HTTP 404']);
  });

  it('reports every broken check at once, not just the first', () => {
    const result = evaluate({
      generatedUtc: generatedHoursAgo(48),
      entries: [],
      coverage: { matchedCatalogKeys: 0 },
    });
    expect(result.failures).toHaveLength(3);
  });
});

describe('the fetch the alarm makes', () => {
  const okResponse = (body) => ({ status: 200, text: async () => body });

  it('reads the file both shipped apps read, once', async () => {
    const calls = [];
    const result = await checkPublishedSnapshot({
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return okResponse(snapshotBody());
      },
      now: () => NOW_MS,
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(SNAPSHOT_URL);
  });

  it('fails when the URL is unreachable, rather than throwing past the alarm', async () => {
    const result = await checkPublishedSnapshot({
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
      now: () => NOW_MS,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      'the published snapshot could not be fetched: getaddrinfo ENOTFOUND',
    ]);
  });

  it('fails when the publish target has been deleted or renamed', async () => {
    const result = await checkPublishedSnapshot({
      fetchImpl: async () => ({ status: 404, text: async () => '404: Not Found' }),
      now: () => NOW_MS,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(['the published snapshot could not be fetched: HTTP 404']);
  });
});

describe('what the alarm prints', () => {
  it('states the symptom on failure and the counts on success', () => {
    expect(renderSummary(evaluate({ generatedUtc: generatedHoursAgo(9) }))).toBe(
      `the published snapshot has not advanced in 9.0 hours (threshold ${MAX_AGE_HOURS})`,
    );
    expect(renderSummary(evaluate())).toBe(
      [
        'the published snapshot advanced 1.0 hours ago',
        'its freshest reading is 1.0 hours old',
        '1 entries, 1 catalog keys matched',
      ].join('\n'),
    );
  });
});
