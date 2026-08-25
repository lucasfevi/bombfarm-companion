import { describe, expect, it } from 'vitest';
import { createEventDeduper } from './dedup.js';

function fakeClock(startAt = 0): { now: () => number; advance(ms: number): void } {
  let current = startAt;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('createEventDeduper', () => {
  it('logs a first boundary event in full', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now });

    deduper.report({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234 });

    expect(emitted).toEqual([{ scope: 'live-source', event: 'tap.attach_failed', pid: 1234 }]);
  });

  it('does not log an identical recurrence individually', () => {
    const emitted: Record<string, unknown>[] = [];
    const clock = fakeClock();
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: clock.now });

    deduper.report({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234 });
    deduper.report({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234 });
    deduper.report({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234 });

    expect(emitted).toHaveLength(1);
  });

  it('reports the exact suppressed count once flushed', () => {
    const emitted: Record<string, unknown>[] = [];
    const clock = fakeClock();
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: clock.now });

    deduper.report({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234 });
    for (let i = 0; i < 9; i += 1) {
      deduper.report({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234 });
    }
    deduper.flush();

    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234, suppressedCount: 9 });
  });

  it('produces a bounded number of lines and exact suppressed counts across 36000 identical events', () => {
    const emitted: Record<string, unknown>[] = [];
    const clock = fakeClock();
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: clock.now });

    const TOTAL_EVENTS = 36_000;
    for (let i = 0; i < TOTAL_EVENTS; i += 1) {
      deduper.report({ scope: 'live-source', event: 'frame.tick', frame: 'stable' });
    }
    deduper.flush();

    expect(emitted).toHaveLength(2);

    const [first, summary] = emitted;
    expect(first).toEqual({ scope: 'live-source', event: 'frame.tick', frame: 'stable' });
    expect(summary).toMatchObject({ scope: 'live-source', event: 'frame.tick', frame: 'stable', suppressedCount: TOTAL_EVENTS - 1 });
  });

  it('spreads emitted lines across periodic flushes without growing proportionally to event volume', () => {
    const emitted: Record<string, unknown>[] = [];
    const clock = fakeClock();
    const deduper = createEventDeduper({
      emit: (record) => emitted.push(record),
      now: clock.now,
      countFlushIntervalMs: 900_000,
    });

    const TOTAL_EVENTS = 36_000;
    for (let i = 0; i < TOTAL_EVENTS; i += 1) {
      deduper.report({ scope: 'live-source', event: 'frame.tick', frame: 'stable' });
      clock.advance(100);
    }
    deduper.flush();

    expect(emitted.length).toBeLessThan(20);

    const summaries = emitted.filter((record) => typeof record.suppressedCount === 'number');
    const totalSuppressed = summaries.reduce((sum, record) => sum + (record.suppressedCount as number), 0);
    expect(totalSuppressed).toBe(TOTAL_EVENTS - 1);
  });

  it('treats two field-drop events differing only by hero as the same problem', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now });

    deduper.report({ scope: 'live-source', event: 'field.drop', heroId: 'hero-1', field: 'attack', reason: 'nan' });
    deduper.report({ scope: 'live-source', event: 'field.drop', heroId: 'hero-2', field: 'attack', reason: 'nan' });

    expect(emitted).toHaveLength(1);
  });

  it('treats two field-drop events differing by field path as distinct problems', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now });

    deduper.report({ scope: 'live-source', event: 'field.drop', heroId: 'hero-1', field: 'attack', reason: 'nan' });
    deduper.report({ scope: 'live-source', event: 'field.drop', heroId: 'hero-1', field: 'defense', reason: 'nan' });

    expect(emitted).toHaveLength(2);
  });

  it('treats two field-drop events differing by reason as distinct problems', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now });

    deduper.report({ scope: 'live-source', event: 'field.drop', heroId: 'hero-1', field: 'attack', reason: 'nan' });
    deduper.report({ scope: 'live-source', event: 'field.drop', heroId: 'hero-1', field: 'attack', reason: 'negative' });

    expect(emitted).toHaveLength(2);
  });

  it('treats keys in a different order as the same dedup key', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now });

    deduper.report({ a: 1, b: 2 });
    deduper.report({ b: 2, a: 1 });

    expect(emitted).toHaveLength(1);
  });

  it('evicts the least recently seen entry once the table overflows, and reports the eviction exactly once', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now, maxEntries: 2 });

    deduper.report({ event: 'a' });
    deduper.report({ event: 'b' });
    deduper.report({ event: 'c' });
    deduper.report({ event: 'd' });
    deduper.report({ event: 'e' });

    const evictionMarkers = emitted.filter((record) => record.event === 'dedup.entry_evicted');
    expect(evictionMarkers).toHaveLength(1);
    expect(deduper.size()).toBe(2);
  });

  it('reports an evicted entry’s suppressed occurrences instead of discarding them', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now, maxEntries: 2 });

    deduper.report({ event: 'noisy' });
    for (let i = 0; i < 500; i += 1) deduper.report({ event: 'noisy' });
    deduper.report({ event: 'other' });
    deduper.report({ event: 'pushes-noisy-out' });

    const summary = emitted.find(
      (record) => record.event === 'noisy' && record.suppressedCount !== undefined,
    );
    expect(summary, 'the evicted entry’s count was dropped rather than reported').toBeDefined();
    expect(summary?.suppressedCount).toBe(500);
  });

  it('evicts the entry that has gone longest without being seen again, not the entry created first', () => {
    const emitted: Record<string, unknown>[] = [];
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: fakeClock().now, maxEntries: 2 });

    deduper.report({ event: 'a' });
    deduper.report({ event: 'b' });
    deduper.report({ event: 'a' });
    deduper.report({ event: 'c' });

    expect(deduper.size()).toBe(2);
    deduper.report({ event: 'b' });
    expect(emitted.filter((record) => record.event === 'b')).toHaveLength(2);
  });

  it('does not re-emit a key in full after flush clears its count', () => {
    const emitted: Record<string, unknown>[] = [];
    const clock = fakeClock();
    const deduper = createEventDeduper({ emit: (record) => emitted.push(record), now: clock.now });

    deduper.report({ event: 'a' });
    deduper.report({ event: 'a' });
    deduper.flush();
    deduper.report({ event: 'a' });

    const fullOccurrences = emitted.filter((record) => record.suppressedCount === undefined);
    expect(fullOccurrences).toHaveLength(1);
  });

  it('emits a summary automatically once the configured interval has elapsed, without a timer', () => {
    const emitted: Record<string, unknown>[] = [];
    const clock = fakeClock();
    const deduper = createEventDeduper({
      emit: (record) => emitted.push(record),
      now: clock.now,
      countFlushIntervalMs: 500,
    });

    deduper.report({ event: 'a' });
    deduper.report({ event: 'a' });
    clock.advance(600);
    deduper.report({ event: 'a' });

    const summaries = emitted.filter((record) => typeof record.suppressedCount === 'number');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ suppressedCount: 2 });
  });
});
