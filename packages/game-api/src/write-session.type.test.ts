/**
 * Compile-time assertions for the write capability, enforced only by
 * `pnpm --filter @bombfarm/game-api typecheck:tests` — see `session.type.test.ts` for why.
 */
import { describe, expect, it } from 'vitest';
import { ConsentedSessionRequiredError, SessionToken, grantSession } from './session.js';
import { grantedConsent } from './test-fixtures.js';
import { grantWriteSession, isWriteSession, type WriteSession } from './write-session.js';

describe('write-session.ts — type-level assertions (runtime half, so this file also runs under Vitest)', () => {
  it('a consented session and the switch on construct a write session normally', () => {
    const consented = grantSession(grantedConsent('2026-09-03T00:00:00.000Z'), {
      accountId: '486',
      token: SessionToken.create('x'),
    });
    expect(isWriteSession(grantWriteSession(consented, { forgeWritesEnabled: true }))).toBe(true);
  });

  it('a bare credential object fails to compile at the grantWriteSession call site, and throws at runtime', () => {
    expect(() => {
      grantWriteSession(
        // @ts-expect-error - grantWriteSession requires a ConsentedSession; a bare credential object is not one
        { accountId: '486', token: SessionToken.create('x'), grantedAt: '2026-09-03T00:00:00.000Z' },
        { forgeWritesEnabled: true },
      );
    }).toThrow(ConsentedSessionRequiredError);
  });
});

// --- Compile-time-only assertions below: no runtime behaviour, enforced by `tsc` only. ---

// @ts-expect-error - WriteSession is a class with a true private #brand field, which makes it
// nominally typed; no object literal constructed anywhere else can satisfy it
const _forgedWriteSession: WriteSession = {
  session: grantSession(grantedConsent('2026-09-03T00:00:00.000Z'), {
    accountId: '486',
    token: SessionToken.create('x'),
  }),
};
