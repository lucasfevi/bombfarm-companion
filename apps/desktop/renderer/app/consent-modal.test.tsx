import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT_VERSION, initialConsent, type ConsentRecord } from '@bombfarm/game-api';
import { isConsentModalVisible } from './consent-modal';

const revoked: ConsentRecord = { decision: 'revoked', textVersion: CONSENT_TEXT_VERSION };
const granted: ConsentRecord = {
  decision: 'granted',
  grantedAt: '2026-08-24T00:00:00.000Z',
  textVersion: CONSENT_TEXT_VERSION,
};
const grantedOnAnOldDisclosure: ConsentRecord = {
  decision: 'granted',
  grantedAt: '2026-08-24T00:00:00.000Z',
  textVersion: CONSENT_TEXT_VERSION - 1,
};

describe('isConsentModalVisible — does not appear on its own for a record that should not trigger it', () => {
  it('a revoked record stays hidden without forceOpen', () => {
    expect(isConsentModalVisible(revoked, false)).toBe(false);
  });

  it('a current, fully granted record stays hidden without forceOpen', () => {
    expect(isConsentModalVisible(granted, false)).toBe(false);
  });
});

describe('isConsentModalVisible — appears when forced open, for a record that would otherwise stay hidden', () => {
  it('a revoked record appears once forced open', () => {
    expect(isConsentModalVisible(revoked, true)).toBe(true);
  });

  it('a current, fully granted record appears once forced open (the settings re-allow path)', () => {
    expect(isConsentModalVisible(granted, true)).toBe(true);
  });
});

describe('isConsentModalVisible — unchanged existing behaviour', () => {
  it('an unasked record appears on its own, forceOpen or not', () => {
    expect(isConsentModalVisible(initialConsent(), false)).toBe(true);
    expect(isConsentModalVisible(initialConsent(), true)).toBe(true);
  });

  it('a grant that predates the current disclosure version re-prompts on its own', () => {
    expect(isConsentModalVisible(grantedOnAnOldDisclosure, false)).toBe(true);
  });

  it('never appears before the record has loaded, even when forced open', () => {
    expect(isConsentModalVisible(null, true)).toBe(false);
  });
});
