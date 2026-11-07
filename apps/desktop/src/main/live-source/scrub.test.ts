import { describe, expect, it } from 'vitest';
import { CREDENTIAL_KEY_NAMES, PERSONAL_FIELDS, redactText, scrubCredentials, scrubJsonValue } from './scrub.js';

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

describe('scrubCredentials', () => {
  const MARKER = 'tok-MARKER-7f3a91';
  const SECRETS = new Set([MARKER]);
  const serialized = (value: unknown): string => JSON.stringify(scrubCredentials(value, SECRETS));

  it('removes a credential-named key, key included', () => {
    const out = scrubCredentials({ sessionToken: MARKER, phase: 26 }, SECRETS);

    expect(out).toEqual({ phase: 26 });
  });

  it('removes a credential-named key at any nesting depth, key included', () => {
    const out = scrubCredentials({ a: { b: [{ c: { token: 'x', keep: 1 } }] } }, SECRETS);

    expect(out).toEqual({ a: { b: [{ c: { keep: 1 } }] } });
  });

  it('removes a credential key nested under another credential key', () => {
    const out = scrubCredentials({ cookie: { token: 'x', other: 1 }, keep: 1 }, SECRETS);

    expect(out).toEqual({ keep: 1 });
  });

  it('removes a key whose string value contains a registered secret, key included', () => {
    const out = scrubCredentials({ note: `Bearer ${MARKER} expires`, keep: 'visible' }, SECRETS);

    expect(out).toEqual({ keep: 'visible' });
    expect(serialized({ deep: { note: `x${MARKER}y` } })).not.toContain(MARKER);
  });

  it('removes an array element that is a string containing a secret, leaving no placeholder', () => {
    const out = scrubCredentials({ list: ['fine', MARKER, `pre-${MARKER}`, { n: 1 }] }, SECRETS);

    expect(out).toEqual({ list: ['fine', { n: 1 }] });
  });

  it('ignores an empty-string secret rather than removing every string', () => {
    const out = scrubCredentials({ a: 'text', list: ['x', ''] }, new Set(['']));

    expect(out).toEqual({ a: 'text', list: ['x', ''] });
  });

  it('removes cookie- and auth-named fields whatever their spelling or value', () => {
    const out = scrubCredentials(
      { Cookie: 'a=b', 'set-cookie': 'c=d', Authorization: 'Bearer zzz', auth_token: 'q', x: { password: 'p' }, keep: 1 },
      SECRETS,
    );

    expect(out).toEqual({ x: {}, keep: 1 });
  });

  it('keeps account_id and player_name', () => {
    const input = { account_id: '486', player_name: 'someone', nested: { account_id: '1', player_name: 'two' } };

    expect(scrubCredentials(input, SECRETS)).toEqual(input);
  });

  it('keeps non-string leaves and does not mutate its input', () => {
    const input = { n: 1, b: true, z: null, arr: [1, 'a'], token: 'x' };
    const copy = structuredClone(input);

    expect(scrubCredentials(input, SECRETS)).toEqual({ n: 1, b: true, z: null, arr: [1, 'a'] });
    expect(input).toEqual(copy);
  });

  it('exports a credential list that excludes the pass-through fields', () => {
    expect(CREDENTIAL_KEY_NAMES).toContain('token');
    expect(CREDENTIAL_KEY_NAMES).toContain('cookie');
    expect(CREDENTIAL_KEY_NAMES).not.toContain('accountId');
    expect(CREDENTIAL_KEY_NAMES).not.toContain('playerName');
  });
});
