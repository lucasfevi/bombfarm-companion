import { describe, expect, it } from 'vitest';
import { PERSONAL_FIELDS, redactText, scrubJsonValue } from './scrub.js';

const NO_SECRETS = new Set<string>();

describe('scrubJsonValue', () => {
  it('removes a personal field outright rather than blanking it', () => {
    const scrubbed = scrubJsonValue({ account_id: '486', player_name: 'someone', phase: 26 }, NO_SECRETS, null);

    expect(scrubbed).toEqual({ phase: 26 });
    for (const field of PERSONAL_FIELDS) {
      expect(Object.keys(scrubbed as Record<string, unknown>)).not.toContain(field);
    }
  });

  it('blanks a sensitive-named key at any nesting depth', () => {
    const scrubbed = scrubJsonValue(
      { outer: { inner: { sessionToken: 'a1b2c3d4e5f6', keep: 'visible' } } },
      NO_SECRETS,
      null,
    );

    expect(scrubbed).toEqual({ outer: { inner: { sessionToken: '[redacted]', keep: 'visible' } } });
  });

  it('replaces a registered secret inside a longer string, leaving the rest of the text', () => {
    const scrubbed = scrubJsonValue({ note: 'Bearer a1b2c3d4e5f6 expires soon' }, new Set(['a1b2c3d4e5f6']), null);

    expect(scrubbed).toEqual({ note: 'Bearer [redacted] expires soon' });
  });

  it('applies the credential redactor to every string leaf, including inside arrays', () => {
    const redact = (text: string): string => text.split('tok-9').join('[redacted]');
    const scrubbed = scrubJsonValue({ items: ['tok-9', { deep: 'holds tok-9 here' }] }, NO_SECRETS, redact);

    expect(scrubbed).toEqual({ items: ['[redacted]', { deep: 'holds [redacted] here' }] });
  });

  it('traverses arrays element by element rather than passing them through whole', () => {
    const scrubbed = scrubJsonValue([{ account_id: '486', a: 1 }, { token: 'zzz', b: 2 }], NO_SECRETS, null);

    expect(scrubbed).toEqual([{ a: 1 }, { token: '[redacted]', b: 2 }]);
  });

  it('returns every value that is neither an object nor a string unchanged', () => {
    expect(scrubJsonValue({ n: 26, b: true, z: null }, NO_SECRETS, null)).toEqual({ n: 26, b: true, z: null });
    expect(scrubJsonValue(26, NO_SECRETS, null)).toBe(26);
    expect(scrubJsonValue(null, NO_SECRETS, null)).toBeNull();
  });
});

describe('redactText', () => {
  it('replaces every occurrence of a registered secret, not only the first', () => {
    expect(redactText('a1b2c3 then a1b2c3', new Set(['a1b2c3']), null)).toBe('[redacted] then [redacted]');
  });

  it('runs the credential redactor after the registered secrets, so both layers apply', () => {
    const redact = (text: string): string => text.split('second').join('[redacted]');

    expect(redactText('first and second', new Set(['first']), redact)).toBe('[redacted] and [redacted]');
  });

  it('ignores an empty registered secret rather than splitting the text on it', () => {
    expect(redactText('unchanged', new Set(['']), null)).toBe('unchanged');
  });
});
