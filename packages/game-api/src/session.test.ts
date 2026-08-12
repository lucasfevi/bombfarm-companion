import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import type { GrantedConsent } from './consent.js';
import { ConsentRequiredError, RAW, SessionToken, grantSession } from './session.js';

const SENTINEL = 'sentinel-7f3a9c2e-do-not-leak';

describe('SessionToken — a token cannot be printed (LAR-12)', () => {
  const cases: ReadonlyArray<{ readonly label: string; readonly render: (t: SessionToken) => string }> = [
    { label: 'String()', render: (t) => String(t) },
    {
      label: 'template literal',
      // The point of this case is proving toString() redacts inside a template literal.
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      render: (t) => `${t}`,
    },
    { label: 'JSON.stringify', render: (t) => JSON.stringify({ token: t }) },
    { label: 'util.inspect', render: (t) => inspect(t, { depth: null }) },
    { label: 'thrown Error message', render: (t) => new Error(String(t)).message },
    { label: 'thrown Error stack', render: (t) => new Error(String(t)).stack ?? '' },
    {
      label: 'a captured log-port line',
      render: (t) => {
        const lines: string[] = [];
        const log = { info: (...args: unknown[]) => lines.push(args.map(String).join(' ')) };
        log.info('token acquired:', t);
        return lines.join('\n');
      },
    },
  ];

  for (const { label, render } of cases) {
    it(`renders '[redacted]' and never the raw value via ${label}`, () => {
      const token = SessionToken.create(SENTINEL);
      const rendered = render(token);
      expect(rendered).toContain('[redacted]');
      expect(rendered).not.toContain(SENTINEL);
    });
  }

  it('exposes nothing through Object.keys, Object.entries or spread', () => {
    const token = SessionToken.create(SENTINEL);
    expect(Object.keys(token)).toEqual([]);
    expect(Object.entries(token)).toEqual([]);
    // Proves a spread of the instance (a plausible accidental-leak call site) still exposes
    // nothing, prototype loss included.
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    expect(JSON.stringify({ ...token })).not.toContain(SENTINEL);
  });

  it('rejects an empty token', () => {
    expect(() => SessionToken.create('   ')).toThrow();
  });

  it('trims surrounding whitespace before storing', () => {
    const token = SessionToken.create(`  ${SENTINEL}  `);
    expect(token[RAW]).toBe(SENTINEL);
  });

  it('the RAW symbol is the only way to read the value back out', () => {
    const token = SessionToken.create(SENTINEL);
    expect(token[RAW]).toBe(SENTINEL);
  });
});

describe('grantSession — runtime enforcement (AD-025: independent of the compile-time check)', () => {
  const NOW = '2026-08-12T13:15:38.000Z';
  const creds = { accountId: '486', token: SessionToken.create(SENTINEL) };

  it('constructs a ConsentedSession from a granted record', () => {
    const granted: GrantedConsent = { decision: 'granted', grantedAt: NOW, textVersion: 1 };
    const session = grantSession(granted, creds);
    expect(session.accountId).toBe('486');
    expect(session.grantedAt).toBe(NOW);
    expect(session.token).toBe(creds.token);
  });

  it('throws ConsentRequiredError for an untyped caller passing a declined record cast through unknown', () => {
    const declined = { decision: 'declined', textVersion: 1 } as unknown as GrantedConsent;
    expect(() => grantSession(declined, creds)).toThrow(ConsentRequiredError);
  });

  it('throws ConsentRequiredError for an untyped caller passing an unasked record cast through unknown', () => {
    const unasked = { decision: 'unasked', textVersion: 1 } as unknown as GrantedConsent;
    expect(() => grantSession(unasked, creds)).toThrow(ConsentRequiredError);
  });

  it('throws ConsentRequiredError for an untyped caller passing a revoked record cast through unknown', () => {
    const revoked = { decision: 'revoked', textVersion: 1 } as unknown as GrantedConsent;
    expect(() => grantSession(revoked, creds)).toThrow(ConsentRequiredError);
  });

  it('throws ConsentRequiredError for a granted-shaped record missing grantedAt, cast through unknown', () => {
    const malformed = { decision: 'granted', textVersion: 1 } as unknown as GrantedConsent;
    expect(() => grantSession(malformed, creds)).toThrow(ConsentRequiredError);
  });
});
