import type { AccountFidelity, AccountPayload, SectionFidelity } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS, deriveAccountFidelity } from '@bombfarm/domain/account-fidelity';
import { describe, expect, it } from 'vitest';
import { assertCaptureFullFidelity } from './helpers/fidelity-grade';
import { FidelityGateError } from './helpers/fidelity-gate-error';

const CAPTURED_AT = '2026-08-12T00:00:00.000Z';
const RESOLVED: SectionFidelity = { status: 'resolved', capturedAt: CAPTURED_AT };
const STALE: SectionFidelity = { status: 'stale', capturedAt: CAPTURED_AT };
const MISSING: SectionFidelity = { status: 'missing' };

function allResolved(): AccountFidelity {
  return { account: RESOLVED, heroes: RESOLVED, skills: RESOLVED, casa: RESOLVED, items: RESOLVED };
}

function payloadWith(fidelity: AccountFidelity | undefined): AccountPayload {
  return { account: {}, heroes: [], skills: {}, casa: {}, items: [], fidelity };
}

function expectFidelityError(fn: () => void, code: string): FidelityGateError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(FidelityGateError);
    expect((err as FidelityGateError).code).toBe(code);
    return err as FidelityGateError;
  }
  throw new Error(`expected fn to throw FidelityGateError(${code}), but it did not throw`);
}

describe('assertCaptureFullFidelity', () => {
  it('throws unverifiableFidelity when the payload carries no fidelity block at all (FID-07)', () => {
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(undefined), 'live'), 'unverifiableFidelity');
    expect(err.message).toContain('live');
    expect(err.message).toContain('unverifiable');
    expect(err.message).toContain('not "full"');
  });

  it('pins the intentional divergence from ACS-05.5: deriveAccountFidelity(undefined) still grades full', () => {
    // The guard does NOT delegate the absent-block decision to deriveAccountFidelity (design
    // TD-3) — ACS-05.5 is correct for the file adapter and would be wrong here.
    expect(deriveAccountFidelity(undefined)).toEqual({ grade: 'full', degradedSections: [] });
  });

  it('accepts a fully-resolved fidelity block (grade full)', () => {
    expect(() => assertCaptureFullFidelity(payloadWith(allResolved()), 'live')).not.toThrow();
  });

  for (const section of ACCOUNT_SECTIONS) {
    it(`throws unverifiableFidelity naming "${section}" when that section key is absent from the block`, () => {
      const fidelity = allResolved();
      const partial = { ...fidelity } as Record<string, unknown>;
      delete partial[section];
      const err = expectFidelityError(
        () => assertCaptureFullFidelity(payloadWith(partial as unknown as AccountFidelity), 'live'),
        'unverifiableFidelity',
      );
      expect(err.message).toContain(section);
    });
  }

  it('throws unverifiableFidelity naming the section when a resolved section has no capturedAt', () => {
    const fidelity = { ...allResolved(), heroes: { status: 'resolved' } as unknown as SectionFidelity };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'unverifiableFidelity');
    expect(err.message).toContain('heroes');
  });

  it('throws unverifiableFidelity naming the section when a stale section has no capturedAt', () => {
    const fidelity = { ...allResolved(), casa: { status: 'stale' } as unknown as SectionFidelity };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'unverifiableFidelity');
    expect(err.message).toContain('casa');
  });

  it('a missing section needs no capturedAt (shape is still usable) — grade check runs and fails as notFullFidelity, not unverifiableFidelity', () => {
    const fidelity = { ...allResolved(), skills: MISSING };
    expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'notFullFidelity');
  });

  it('throws notFullFidelity when the grade is degraded (one section stale), naming it with its literal status', () => {
    const fidelity = { ...allResolved(), skills: STALE };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'notFullFidelity');
    expect(err.message).toContain('skills: stale');
  });

  it('throws notFullFidelity when the grade is degraded (one section missing), naming it with its literal status', () => {
    const fidelity = { ...allResolved(), skills: MISSING };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'notFullFidelity');
    expect(err.message).toContain('skills: missing');
  });

  it('names every non-resolved section with its literal status, in ACCOUNT_SECTIONS order, for a mixed stale+missing case', () => {
    const fidelity: AccountFidelity = { ...allResolved(), skills: MISSING, casa: STALE };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'notFullFidelity');
    expect(err.message).toContain('skills: missing');
    expect(err.message).toContain('casa: stale');
    // ACCOUNT_SECTIONS order is account, heroes, skills, casa, items — skills precedes casa.
    expect(err.message.indexOf('skills: missing')).toBeLessThan(err.message.indexOf('casa: stale'));
  });

  it('throws notFullFidelity (unavailable) when every section is missing', () => {
    const fidelity: AccountFidelity = {
      account: MISSING,
      heroes: MISSING,
      skills: MISSING,
      casa: MISSING,
      items: MISSING,
    };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'notFullFidelity');
    for (const section of ACCOUNT_SECTIONS) {
      expect(err.message).toContain(`${section}: missing`);
    }
  });

  it('the message does not contain the name of any resolved section', () => {
    const fidelity: AccountFidelity = { ...allResolved(), skills: MISSING };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'notFullFidelity');
    for (const section of ACCOUNT_SECTIONS) {
      if (section === 'skills') continue;
      expect(err.message).not.toContain(`${section}:`);
    }
  });

  it('accepts a cast-in future "degraded" status as a valid shape and names it verbatim (AD-023 forward-compat, zero edits here)', () => {
    const futureSection = { status: 'degraded', capturedAt: CAPTURED_AT } as unknown as SectionFidelity;
    const fidelity = { ...allResolved(), items: futureSection };
    const err = expectFidelityError(() => assertCaptureFullFidelity(payloadWith(fidelity), 'live'), 'notFullFidelity');
    expect(err.message).toContain('items: degraded');
  });
});
