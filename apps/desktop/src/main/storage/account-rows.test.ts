import { describe, expect, it } from 'vitest';
import type { AccountSection } from '@bombfarm/contracts';
import { decodeStoredSection, resolveAccountKey } from './account-rows.js';

const ARRAY_SECTIONS: AccountSection[] = ['heroes', 'items'];
const OBJECT_SECTIONS: AccountSection[] = ['account', 'skills', 'casa'];
const ALL_SECTIONS: AccountSection[] = [...OBJECT_SECTIONS, ...ARRAY_SECTIONS];

describe('decodeStoredSection', () => {
  for (const section of OBJECT_SECTIONS) {
    it(`${section}: decodes a valid plain object`, () => {
      const result = decodeStoredSection(section, '{"phase":42}');
      expect(result).toEqual({ ok: true, body: { phase: 42 } });
    });

    it(`${section}: rejects an array as the wrong container`, () => {
      expect(decodeStoredSection(section, '[1,2,3]')).toEqual({ ok: false, reason: 'wrong_container' });
    });
  }

  for (const section of ARRAY_SECTIONS) {
    it(`${section}: decodes a valid array`, () => {
      const result = decodeStoredSection(section, '[{"id":"a"}]');
      expect(result).toEqual({ ok: true, body: [{ id: 'a' }] });
    });

    it(`${section}: rejects a plain object as the wrong container`, () => {
      expect(decodeStoredSection(section, '{"id":"a"}')).toEqual({ ok: false, reason: 'wrong_container' });
    });
  }

  for (const section of ALL_SECTIONS) {
    it(`${section}: rejects a bare null`, () => {
      expect(decodeStoredSection(section, 'null')).toEqual({ ok: false, reason: 'wrong_container' });
    });

    it(`${section}: rejects a bare number`, () => {
      expect(decodeStoredSection(section, '42')).toEqual({ ok: false, reason: 'wrong_container' });
    });

    it(`${section}: rejects a bare string`, () => {
      expect(decodeStoredSection(section, '"hello"')).toEqual({ ok: false, reason: 'wrong_container' });
    });

    it(`${section}: rejects truncated JSON as invalid`, () => {
      expect(decodeStoredSection(section, '{"a":1')).toEqual({ ok: false, reason: 'invalid_json' });
    });

    it(`${section}: rejects the literal text "undefined" as invalid`, () => {
      expect(decodeStoredSection(section, 'undefined')).toEqual({ ok: false, reason: 'invalid_json' });
    });

    it(`${section}: never throws for garbage input`, () => {
      expect(() => decodeStoredSection(section, '{not even close to json')).not.toThrow();
      expect(() => decodeStoredSection(section, '')).not.toThrow();
    });
  }

  it('performs no field-level normalization — an unfamiliar extra key survives untouched', () => {
    const result = decodeStoredSection('account', '{"phase":1,"someFutureField":"kept as-is"}');
    expect(result).toEqual({ ok: true, body: { phase: 1, someFutureField: 'kept as-is' } });
  });

  it('preserves original key order rather than reconstructing the object', () => {
    const result = decodeStoredSection('account', '{"z":1,"a":2,"m":3}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.body as object)).toEqual(['z', 'a', 'm']);
    }
  });
});

describe('resolveAccountKey', () => {
  it('(null, null): cold start with no bound and no incoming key resolves to the empty key', () => {
    expect(resolveAccountKey(null, null)).toEqual({ key: '', mismatch: false, rebind: false });
  });

  it("(null, 'A'): an unset bound key binds to the incoming key", () => {
    expect(resolveAccountKey(null, 'A')).toEqual({ key: 'A', mismatch: false, rebind: true });
  });

  it("('A', null): no live account id is knowable, so the bound key is used as-is", () => {
    expect(resolveAccountKey('A', null)).toEqual({ key: 'A', mismatch: false, rebind: false });
  });

  it("('A', 'A'): an equal incoming key is a no-op", () => {
    expect(resolveAccountKey('A', 'A')).toEqual({ key: 'A', mismatch: false, rebind: false });
  });

  it("('A', 'B'): a different incoming key is a mismatch that rebinds to the new key", () => {
    expect(resolveAccountKey('A', 'B')).toEqual({ key: 'B', mismatch: true, rebind: true });
  });

  it("('', 'A'): an empty-string bound key is treated as unset and binds to the incoming key", () => {
    expect(resolveAccountKey('', 'A')).toEqual({ key: 'A', mismatch: false, rebind: true });
  });
});
