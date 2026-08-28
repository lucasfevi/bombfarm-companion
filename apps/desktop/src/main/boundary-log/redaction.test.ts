import { describe, expect, it } from 'vitest';
import { SENSITIVE_KEY_NAMES, createRedactor } from './redaction.js';

describe('createRedactor', () => {
  it.each(SENSITIVE_KEY_NAMES)('replaces the sensitive key "%s" with a marker at any depth', (key) => {
    const redactor = createRedactor();

    const result = redactor.redact({ scope: 'live-source', nested: { [key]: 'secret-value' } });

    expect((result.nested as Record<string, unknown>)[key]).toBe('[redacted]');
  });

  it('matches sensitive key names regardless of case and separator style', () => {
    const redactor = createRedactor();

    const result = redactor.redact({ account_id: 'a1', playerName: 'p1', SESSION_TOKEN: 't1' });

    expect(result.account_id).toBe('[redacted]');
    expect(result.playerName).toBe('[redacted]');
    expect(result.SESSION_TOKEN).toBe('[redacted]');
  });

  it('leaves non-sensitive keys and primitive values untouched', () => {
    const redactor = createRedactor();

    const result = redactor.redact({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234, ok: true, note: null });

    expect(result).toEqual({ scope: 'live-source', event: 'tap.attach_failed', pid: 1234, ok: true, note: null });
  });

  it('redacts a registered secret wherever it appears as a substring of a longer string', () => {
    const redactor = createRedactor();
    redactor.registerSecret('abc123session');

    const result = redactor.redact({ error: 'connection failed for token abc123session during handshake' });

    expect(result.error).not.toContain('abc123session');
    expect(result.error).toBe('connection failed for token [redacted] during handshake');
  });

  it('redacts a registered secret inside array elements and nested objects', () => {
    const redactor = createRedactor();
    redactor.registerSecret('super-secret-token');

    const result = redactor.redact({ logs: ['first: super-secret-token', { nested: 'second super-secret-token here' }] });

    expect(JSON.stringify(result)).not.toContain('super-secret-token');
  });

  it('refuses to register a secret shorter than the minimum length', () => {
    const redactor = createRedactor();
    redactor.registerSecret('ab');

    const result = redactor.redact({ note: 'ab appears in unrelated text like abandon and cabbage' });

    expect(result.note).toBe('ab appears in unrelated text like abandon and cabbage');
  });

  it('refuses to register an empty secret', () => {
    const redactor = createRedactor();
    redactor.registerSecret('');

    const result = redactor.redact({ note: 'nothing should change here' });

    expect(result.note).toBe('nothing should change here');
  });

  it('drops a function value as unredactable instead of passing it through', () => {
    const redactor = createRedactor();

    const result = redactor.redact({ handler: () => undefined });

    expect(result.handler).toBe('[unredactable]');
  });

  it('drops a symbol value as unredactable instead of passing it through', () => {
    const redactor = createRedactor();

    const result = redactor.redact({ id: Symbol('id') });

    expect(result.id).toBe('[unredactable]');
  });

  it('drops a bigint value as unredactable instead of passing it through', () => {
    const redactor = createRedactor();

    const result = redactor.redact({ big: 10n });

    expect(result.big).toBe('[unredactable]');
  });

  it('drops a class instance as unredactable instead of passing it through', () => {
    class Custom {
      value = 'should not survive';
    }
    const redactor = createRedactor();

    const result = redactor.redact({ instance: new Custom() });

    expect(result.instance).toBe('[unredactable]');
  });

  it('drops a Map value as unredactable instead of passing it through', () => {
    const redactor = createRedactor();

    const result = redactor.redact({ data: new Map([['a', 1]]) });

    expect(result.data).toBe('[unredactable]');
  });

  it('drops a Set value as unredactable instead of passing it through', () => {
    const redactor = createRedactor();

    const result = redactor.redact({ data: new Set([1, 2, 3]) });

    expect(result.data).toBe('[unredactable]');
  });

  it('drops a circular reference as unredactable instead of looping forever', () => {
    const redactor = createRedactor();
    const record: Record<string, unknown> = { scope: 'live-source' };
    record.self = record;

    const result = redactor.redact(record);

    expect(result.self).toBe('[unredactable]');
  });

  it('drops values past the configured maximum depth', () => {
    const redactor = createRedactor({ maxDepth: 2 });

    const result = redactor.redact({ a: { b: { c: { d: 'too deep' } } } });

    const a = result.a as Record<string, unknown>;
    const b = a.b as Record<string, unknown>;
    expect(b.c).toBe('[unredactable]');
  });

  it('drops values once the configured node budget is exhausted', () => {
    const redactor = createRedactor({ maxNodes: 3 });

    const result = redactor.redact({ a: 1, b: 2, c: 3, d: 4, e: 5 });

    const values = Object.values(result);
    expect(values.filter((value) => value === '[unredactable]').length).toBeGreaterThan(0);
  });

  it('does not mutate the input record', () => {
    const redactor = createRedactor();
    redactor.registerSecret('super-secret-token');
    const record = { token: 'plain', nested: { password: 'p', note: 'contains super-secret-token here' } };
    const snapshot = JSON.parse(JSON.stringify(record)) as typeof record;

    redactor.redact(record);

    expect(record).toEqual(snapshot);
  });

  it('returns a new object rather than the same reference', () => {
    const redactor = createRedactor();
    const record = { scope: 'live-source' };

    expect(redactor.redact(record)).not.toBe(record);
  });
});
