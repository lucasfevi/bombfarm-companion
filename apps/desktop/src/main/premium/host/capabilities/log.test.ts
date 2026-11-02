import { describe, expect, it } from 'vitest';
import { CapabilityError } from '../capability-channel.js';
import { createLogCapability } from './log.js';

function setup() {
  const records: Record<string, unknown>[] = [];
  const call = createLogCapability({
    log: { info: (r) => records.push(r), warn: (r) => records.push(r), error: (r) => records.push(r) },
    sequence: () => 12,
  });
  return { records, call };
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (thrown) {
    if (thrown instanceof CapabilityError) return thrown.code;
    throw thrown;
  }
  return 'none';
}

const HOST_KEYS = ['bundleEvent', 'event', 'scope', 'sequence'];

describe('the log capability', () => {
  it('writes one premium.bundle_log record with the event, the sequence and the kept fields', () => {
    const { records, call } = setup();

    call({ event: 'check.started', fields: { count: 3, ok: true, phase: 'first-run', ratio: 0.5 } });

    expect(records).toEqual([
      {
        scope: 'premium',
        event: 'premium.bundle_log',
        bundleEvent: 'check.started',
        sequence: 12,
        count: 3,
        ok: true,
        phase: 'first-run',
        ratio: 0.5,
      },
    ]);
  });

  it('writes a record with no fields when none are given', () => {
    const { records, call } = setup();

    call({ event: 'a' });

    expect(records).toEqual([{ scope: 'premium', event: 'premium.bundle_log', bundleEvent: 'a', sequence: 12 }]);
  });

  it.each([
    ['an upper-case letter', 'Check'],
    ['a leading digit', '1check'],
    ['a space', 'two words'],
    ['an empty name', ''],
    ['49 characters', 'a'.repeat(49)],
    ['a value that is not a string', 7],
  ])('refuses an event name with %s as bad_args and writes nothing', (_name, event) => {
    const { records, call } = setup();

    expect(refusal(() => call({ event }))).toBe('bad_args');
    expect(records).toEqual([]);
  });

  it('refuses args that are not an object', () => {
    const { records, call } = setup();

    expect(refusal(() => call('check'))).toBe('bad_args');
    expect(refusal(() => call(null))).toBe('bad_args');
    expect(records).toEqual([]);
  });

  it('takes an event name of 48 characters', () => {
    const { records, call } = setup();

    call({ event: 'a'.repeat(48) });

    expect(records[0]?.['bundleEvent']).toBe('a'.repeat(48));
  });

  it('drops free-text string values: a space, an @, an upper-case letter, a digit run over 32 characters', () => {
    const { records, call } = setup();

    call({
      event: 'x',
      fields: {
        spaced: 'hello world',
        mail: 'someone@example.com',
        upper: 'Shouting',
        digits: '1'.repeat(33),
        kept: 'ok_value',
        edge: 'a'.repeat(32),
        over: 'a'.repeat(33),
        empty: '',
      },
    });

    expect(records[0]).toEqual({
      scope: 'premium',
      event: 'premium.bundle_log',
      bundleEvent: 'x',
      sequence: 12,
      kept: 'ok_value',
      edge: 'a'.repeat(32),
      empty: '',
    });
  });

  it('drops values that are not a number, a boolean or a string, and numbers that are not finite', () => {
    const { records, call } = setup();

    call({
      event: 'x',
      fields: { nothing: null, list: [1], nested: { a: 1 }, nan: Number.NaN, inf: Infinity, fine: 1 },
    });

    expect(Object.keys(records[0] ?? {}).sort()).toEqual([...HOST_KEYS, 'fine'].sort());
    expect(records[0]?.['fine']).toBe(1);
  });

  it('drops keys outside the pattern and keeps those on its edge', () => {
    const { records, call } = setup();
    const edge = `a${'b'.repeat(31)}`;

    call({
      event: 'x',
      fields: { Upper: 1, '1num': 1, 'has space': 1, snake_case: 1, long: 1, [edge]: 2, [`${edge}b`]: 3 },
    });

    expect(Object.keys(records[0] ?? {}).sort()).toEqual([...HOST_KEYS, 'long', edge].sort());
  });

  it('keeps at most eight fields', () => {
    const { records, call } = setup();
    const fields = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${String(i)}`, i]));

    call({ event: 'x', fields });

    const keptKeys = Object.keys(records[0] ?? {}).filter((key) => key.startsWith('f'));
    expect(keptKeys).toEqual(['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']);
  });

  it('cannot overwrite the keys the host sets', () => {
    const { records, call } = setup();

    call({ event: 'x', fields: { scope: 'spoof', event: 'spoof', bundleEvent: 'spoof', sequence: 99 } });

    expect(records[0]).toEqual({ scope: 'premium', event: 'premium.bundle_log', bundleEvent: 'x', sequence: 12 });
  });

  it('treats fields that are not an object as none', () => {
    const { records, call } = setup();

    call({ event: 'x', fields: 'free-text' });
    call({ event: 'x', fields: ['a'] });

    expect(records).toHaveLength(2);
    for (const record of records) expect(Object.keys(record).sort()).toEqual(HOST_KEYS);
  });
});
