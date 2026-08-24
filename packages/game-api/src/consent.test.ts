import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT } from './consent-text.js';
import { initialConsent, isGranted, reduceConsent, shouldShowConsentModal } from './consent.js';
import { consentRecord } from './test-fixtures.js';

const NOW = '2026-08-12T13:15:38.000Z';

describe('initialConsent', () => {
  it('starts unasked, stamped with the current disclosure text version', () => {
    expect(initialConsent()).toEqual(consentRecord({ decision: 'unasked' }));
  });
});

describe('reduceConsent — every legal transition, now injected', () => {
  it('unasked -> granted on accept, stamping grantedAt and the text version the player saw', () => {
    const record = reduceConsent(initialConsent(), { type: 'accept', now: NOW });
    expect(record).toEqual(consentRecord({ decision: 'granted', grantedAt: NOW }));
  });

  it('unasked -> declined on decline', () => {
    const record = reduceConsent(initialConsent(), { type: 'decline' });
    expect(record.decision).toBe('declined');
  });

  it('granted -> revoked on revoke, and grantedAt no longer appears', () => {
    const granted = consentRecord({ decision: 'granted', grantedAt: NOW });
    const record = reduceConsent(granted, { type: 'revoke' });
    expect(record.decision).toBe('revoked');
    expect(record.grantedAt).toBeUndefined();
  });

  it('declined -> granted on accept (the player may change their mind)', () => {
    const declined = consentRecord({ decision: 'declined' });
    const record = reduceConsent(declined, { type: 'accept', now: NOW });
    expect(record).toEqual(consentRecord({ decision: 'granted', grantedAt: NOW }));
  });

  it('revoked -> granted on accept', () => {
    const revoked = consentRecord({ decision: 'revoked' });
    const record = reduceConsent(revoked, { type: 'accept', now: NOW });
    expect(record).toEqual(consentRecord({ decision: 'granted', grantedAt: NOW }));
  });

  it('accept always stamps the CURRENT CONSENT_TEXT.version, not whatever textVersion the record carried', () => {
    const staleDecline = consentRecord({ decision: 'declined', textVersion: 0 });
    const record = reduceConsent(staleDecline, { type: 'accept', now: NOW });
    expect(record.textVersion).toBe(CONSENT_TEXT.version);
  });
});

describe('shouldShowConsentModal', () => {
  it('is true for a fresh, unasked record', () => {
    expect(shouldShowConsentModal(initialConsent())).toBe(true);
  });

  it('is true for a granted record whose textVersion is below CONSENT_TEXT.version — a new disclosure cannot ride on an old agreement', () => {
    const staleGrant = consentRecord({ decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version - 1 });
    expect(shouldShowConsentModal(staleGrant)).toBe(true);
  });

  it('is false for a granted record at the current textVersion', () => {
    const currentGrant = consentRecord({ decision: 'granted', grantedAt: NOW });
    expect(shouldShowConsentModal(currentGrant)).toBe(false);
  });

  it('is true for a granted record at the current version with no grantedAt, the shape the read gate also rejects', () => {
    const malformed = consentRecord({ decision: 'granted' });
    expect(isGranted(malformed)).toBe(false);
    expect(shouldShowConsentModal(malformed)).toBe(true);
  });

  it('is false for a declined record', () => {
    const declined = consentRecord({ decision: 'declined' });
    expect(shouldShowConsentModal(declined)).toBe(false);
  });

  it('is false for a revoked record', () => {
    const revoked = consentRecord({ decision: 'revoked' });
    expect(shouldShowConsentModal(revoked)).toBe(false);
  });
});

describe('isGranted', () => {
  it('is true for a granted record with a grantedAt stamp at the current textVersion', () => {
    const granted = consentRecord({ decision: 'granted', grantedAt: NOW });
    expect(isGranted(granted)).toBe(true);
  });

  it('is false for unasked, declined and revoked records', () => {
    expect(isGranted(initialConsent())).toBe(false);
    expect(isGranted(consentRecord({ decision: 'declined' }))).toBe(false);
    expect(isGranted(consentRecord({ decision: 'revoked' }))).toBe(false);
  });

  it('is false for a granted record stamped with an OLDER textVersion — a stale grant does not authorise anything', () => {
    const staleGrant = consentRecord({ decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version - 1 });
    expect(isGranted(staleGrant)).toBe(false);
  });

  it('is false for a granted record stamped with a NEWER textVersion — a downgraded build cannot assume a grant it never showed', () => {
    const futureGrant = consentRecord({ decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version + 1 });
    expect(isGranted(futureGrant)).toBe(false);
  });
});

describe('shouldShowConsentModal — version awareness', () => {
  it('shows the modal again for a granted record stamped with a NEWER textVersion, same as an older one', () => {
    const futureGrant = consentRecord({ decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version + 1 });
    expect(shouldShowConsentModal(futureGrant)).toBe(true);
  });
});
