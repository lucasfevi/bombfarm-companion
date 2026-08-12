/**
 * Type-level assertions for the `AccountPayload` / fidelity contract (ACS-04, ACS-06.1).
 *
 * Vitest transpiles this file with esbuild, which strips types and never typechecks —
 * so every `@ts-expect-error` below is only enforced by `pnpm --filter @bombfarm/contracts
 * typecheck`, which runs `tsc -p tsconfig.typecheck.json --noEmit` (the only tsconfig for
 * this package that includes `src/**\/*.test.ts`). An unused `@ts-expect-error` directive is
 * itself a `tsc` error, so a widened type here fails the build rather than passing silently.
 */
import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, SectionFidelity } from './account-payload.js';

const RESOLVED: SectionFidelity = { status: 'resolved', capturedAt: '2026-08-12T00:00:00.000Z' };

describe('AccountPayload / fidelity — type-level assertions', () => {
  it('accepts a full five-section AccountFidelity block with resolved status', () => {
    const fidelity: AccountFidelity = {
      account: RESOLVED,
      heroes: RESOLVED,
      skills: RESOLVED,
      casa: RESOLVED,
      items: RESOLVED,
    };
    expect(Object.keys(fidelity).sort()).toEqual(['account', 'casa', 'heroes', 'items', 'skills']);
    expect(fidelity.account.capturedAt).toBe('2026-08-12T00:00:00.000Z');
  });

  it('accepts a missing section with no capturedAt', () => {
    const missing: SectionFidelity = { status: 'missing' };
    expect(missing.status).toBe('missing');
    expect(missing.capturedAt).toBeUndefined();
  });

  it('accepts a degraded section carrying capturedAt and missingKeys (mp2-live-account-read T6, LAR-19)', () => {
    const degraded: SectionFidelity = {
      status: 'degraded',
      capturedAt: '2026-08-12T00:00:00.000Z',
      missingKeys: ['gold', 'phase'],
    };
    expect(degraded.status).toBe('degraded');
    expect(degraded.missingKeys).toEqual(['gold', 'phase']);
  });

  it('a degraded section is distinguishable from missing and from resolved by its status discriminant', () => {
    const sections: SectionFidelity[] = [
      { status: 'resolved', capturedAt: '2026-08-12T00:00:00.000Z' },
      { status: 'missing' },
      { status: 'degraded', capturedAt: '2026-08-12T00:00:00.000Z', missingKeys: ['heroes'] },
    ];
    const statuses = sections.map((s) => s.status);
    expect(statuses).toEqual(['resolved', 'missing', 'degraded']);
    expect(new Set(statuses).size).toBe(3);
  });

  it('accepts an AccountFidelity block mixing a degraded section among resolved ones', () => {
    const fidelity: AccountFidelity = {
      account: RESOLVED,
      heroes: RESOLVED,
      skills: { status: 'degraded', capturedAt: '2026-08-12T00:00:00.000Z', missingKeys: ['totals'] },
      casa: RESOLVED,
      items: RESOLVED,
    };
    expect(fidelity.skills.status).toBe('degraded');
    if (fidelity.skills.status === 'degraded') {
      expect(fidelity.skills.missingKeys).toEqual(['totals']);
    }
  });

  it('accepts an empty missingKeys array on a degraded section (a shape check that found nothing missing but still refused to parse is still expressible)', () => {
    const degraded: SectionFidelity = { status: 'degraded', capturedAt: '2026-08-12T00:00:00.000Z', missingKeys: [] };
    expect(degraded.missingKeys).toEqual([]);
  });

  it('accepts an AccountPayload asserting no sections at all', () => {
    const payload: AccountPayload = {};
    expect(payload).toEqual({});
  });

  it('accepts a fully populated AccountPayload with a fidelity block', () => {
    const payload: AccountPayload = {
      account: { phase: 42 },
      heroes: [],
      skills: {},
      casa: {},
      items: [],
      fidelity: {
        account: RESOLVED,
        heroes: RESOLVED,
        skills: RESOLVED,
        casa: RESOLVED,
        items: RESOLVED,
      },
    };
    expect(payload.fidelity?.heroes.status).toBe('resolved');
  });
});

// --- Compile-time-only assertions below: no runtime behaviour, enforced by `tsc` only. ---

// @ts-expect-error - capturedAt is required when status is "resolved" (ACS-04)
const _missingCapturedAt: SectionFidelity = { status: 'resolved' };

// @ts-expect-error - capturedAt must be absent when status is "missing" (ACS-04)
const _capturedAtOnMissing: SectionFidelity = { status: 'missing', capturedAt: '2026-08-12T00:00:00.000Z' };

// @ts-expect-error - "partial" is not one of the four SectionStatus literals (ACS-04)
const _invalidStatusLiteral: SectionFidelity = { status: 'partial', capturedAt: '2026-08-12T00:00:00.000Z' };

// @ts-expect-error - a degraded section requires capturedAt (LAR-19, mp2-live-account-read T6)
const _degradedWithoutCapturedAt: SectionFidelity = { status: 'degraded', missingKeys: ['gold'] };

// @ts-expect-error - a degraded section requires missingKeys (LAR-19, mp2-live-account-read T6)
const _degradedWithoutMissingKeys: SectionFidelity = { status: 'degraded', capturedAt: '2026-08-12T00:00:00.000Z' };

const _missingKeysOnResolved: SectionFidelity = {
  status: 'resolved',
  capturedAt: '2026-08-12T00:00:00.000Z',
  // @ts-expect-error - missingKeys is not a member of the resolved/stale branch (mp2-live-account-read T6)
  missingKeys: ['gold'],
};

// @ts-expect-error - "extra" is not one of the five AccountSection keys
const _sixthSectionKey: AccountFidelity = { account: RESOLVED, heroes: RESOLVED, skills: RESOLVED, casa: RESOLVED, items: RESOLVED, extra: RESOLVED };

// @ts-expect-error - "items" is missing from this AccountFidelity block
const _missingSectionKey: AccountFidelity = {
  account: RESOLVED,
  heroes: RESOLVED,
  skills: RESOLVED,
  casa: RESOLVED,
};

// @ts-expect-error - capturedAt must be a string, not a number
const _nonStringCapturedAt: SectionFidelity = { status: 'resolved', capturedAt: 1755014400000 };

const _examplePayload: AccountPayload = {};
// @ts-expect-error - AccountPayload does not declare export_version (ACS-06.1)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- the point of this line is the tsc error above
const _exportVersion = _examplePayload.export_version;
// @ts-expect-error - AccountPayload does not declare generated_at (ACS-06.1)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- the point of this line is the tsc error above
const _generatedAt = _examplePayload.generated_at;
