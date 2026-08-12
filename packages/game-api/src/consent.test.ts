import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT } from './consent-text.js';
import {
  type ConsentRecord,
  initialConsent,
  isGranted,
  reduceConsent,
  shouldShowConsentModal,
} from './consent.js';

const NOW = '2026-08-12T13:15:38.000Z';

describe('initialConsent', () => {
  it('starts unasked, stamped with the current disclosure text version', () => {
    expect(initialConsent()).toEqual({ decision: 'unasked', textVersion: CONSENT_TEXT.version });
  });
});

describe('reduceConsent — every legal transition, now injected', () => {
  it('unasked -> granted on accept, stamping grantedAt and the text version the player saw', () => {
    const record = reduceConsent(initialConsent(), { type: 'accept', now: NOW });
    expect(record).toEqual({ decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version });
  });

  it('unasked -> declined on decline', () => {
    const record = reduceConsent(initialConsent(), { type: 'decline' });
    expect(record.decision).toBe('declined');
  });

  it('granted -> revoked on revoke, and grantedAt no longer appears', () => {
    const granted: ConsentRecord = { decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version };
    const record = reduceConsent(granted, { type: 'revoke' });
    expect(record.decision).toBe('revoked');
    expect(record.grantedAt).toBeUndefined();
  });

  it('declined -> granted on accept (the player may change their mind)', () => {
    const declined: ConsentRecord = { decision: 'declined', textVersion: CONSENT_TEXT.version };
    const record = reduceConsent(declined, { type: 'accept', now: NOW });
    expect(record).toEqual({ decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version });
  });

  it('revoked -> granted on accept', () => {
    const revoked: ConsentRecord = { decision: 'revoked', textVersion: CONSENT_TEXT.version };
    const record = reduceConsent(revoked, { type: 'accept', now: NOW });
    expect(record).toEqual({ decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version });
  });

  it('accept always stamps the CURRENT CONSENT_TEXT.version, not whatever textVersion the record carried', () => {
    const staleDecline: ConsentRecord = { decision: 'declined', textVersion: 0 };
    const record = reduceConsent(staleDecline, { type: 'accept', now: NOW });
    expect(record.textVersion).toBe(CONSENT_TEXT.version);
  });
});

describe('shouldShowConsentModal', () => {
  it('is true for a fresh, unasked record', () => {
    expect(shouldShowConsentModal(initialConsent())).toBe(true);
  });

  it('is true for a granted record whose textVersion is below CONSENT_TEXT.version — a new disclosure cannot ride on an old agreement', () => {
    const staleGrant: ConsentRecord = {
      decision: 'granted',
      grantedAt: NOW,
      textVersion: CONSENT_TEXT.version - 1,
    };
    expect(shouldShowConsentModal(staleGrant)).toBe(true);
  });

  it('is false for a granted record at the current textVersion', () => {
    const currentGrant: ConsentRecord = { decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version };
    expect(shouldShowConsentModal(currentGrant)).toBe(false);
  });

  it('is false for a declined record', () => {
    const declined: ConsentRecord = { decision: 'declined', textVersion: CONSENT_TEXT.version };
    expect(shouldShowConsentModal(declined)).toBe(false);
  });

  it('is false for a revoked record', () => {
    const revoked: ConsentRecord = { decision: 'revoked', textVersion: CONSENT_TEXT.version };
    expect(shouldShowConsentModal(revoked)).toBe(false);
  });
});

describe('isGranted', () => {
  it('is true for a granted record with a grantedAt stamp', () => {
    const granted: ConsentRecord = { decision: 'granted', grantedAt: NOW, textVersion: CONSENT_TEXT.version };
    expect(isGranted(granted)).toBe(true);
  });

  it('is false for unasked, declined and revoked records', () => {
    expect(isGranted(initialConsent())).toBe(false);
    expect(isGranted({ decision: 'declined', textVersion: CONSENT_TEXT.version })).toBe(false);
    expect(isGranted({ decision: 'revoked', textVersion: CONSENT_TEXT.version })).toBe(false);
  });
});
