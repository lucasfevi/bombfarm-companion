/**
 * Compile-time assertions for the consent capability and the redacting token (LAR-06, LAR-12).
 * Vitest transpiles this file with esbuild, which strips types (but not runtime code) and never
 * typechecks — every `@ts-expect-error` below is enforced only by
 * `pnpm --filter @bombfarm/game-api typecheck:tests` (`tsconfig.typecheck.json`,
 * `AD-021`/`AD-027`). An unused `@ts-expect-error` is itself a `tsc` error, so a widened type
 * here fails the build rather than passing silently.
 *
 * `grantSession` also throws at runtime for a non-granted record (LAR-06's runtime half — see
 * `session.test.ts` for the "cast through unknown" untyped-caller case), so the three call-site
 * assertions below are wrapped in `it(...)` + `expect(...).toThrow()` rather than left as bare
 * module-level statements — esbuild still executes them even though it strips the directive.
 */
import { describe, expect, it } from 'vitest';
import type { ConsentRecord, GrantedConsent } from './consent.js';
import { ConsentRequiredError, type ConsentedSession, SessionToken, grantSession } from './session.js';

describe('session.ts — type-level assertions (runtime half, so this file also runs under Vitest)', () => {
  it('a granted record constructs a session normally (sanity check for the assertions below)', () => {
    const granted: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T00:00:00.000Z', textVersion: 1 };
    const session = grantSession(granted, { accountId: '486', token: SessionToken.create('x') });
    expect(session.accountId).toBe('486');
  });

  it('a declined record fails to compile at the grantSession call site (LAR-06)', () => {
    const declined: ConsentRecord = { decision: 'declined', textVersion: 1 };
    expect(() => {
      // @ts-expect-error - grantSession requires a GrantedConsent; a declined record is not one
      grantSession(declined, { accountId: '486', token: SessionToken.create('x') });
    }).toThrow(ConsentRequiredError);
  });

  it('an unasked record fails to compile at the grantSession call site (LAR-06)', () => {
    const unasked: ConsentRecord = { decision: 'unasked', textVersion: 1 };
    expect(() => {
      // @ts-expect-error - grantSession requires a GrantedConsent; an unasked record is not one
      grantSession(unasked, { accountId: '486', token: SessionToken.create('x') });
    }).toThrow(ConsentRequiredError);
  });

  it('a revoked record fails to compile at the grantSession call site (LAR-06)', () => {
    const revoked: ConsentRecord = { decision: 'revoked', textVersion: 1 };
    expect(() => {
      // @ts-expect-error - grantSession requires a GrantedConsent; a revoked record is not one
      grantSession(revoked, { accountId: '486', token: SessionToken.create('x') });
    }).toThrow(ConsentRequiredError);
  });
});

// --- Compile-time-only assertions below: no runtime behaviour, enforced by `tsc` only. ---

// @ts-expect-error - ConsentedSession's brand key is not nameable outside session.ts, so no
// object literal constructed anywhere else can satisfy this interface (LAR-06, TD-2)
const _forgedSession: ConsentedSession = {
  accountId: '486',
  token: SessionToken.create('x'),
  grantedAt: '2026-08-12T00:00:00.000Z',
};

// @ts-expect-error - SessionToken's constructor is private; only SessionToken.create may build one
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- the point of this line is the tsc error above
const _directToken = new SessionToken('raw-value');
