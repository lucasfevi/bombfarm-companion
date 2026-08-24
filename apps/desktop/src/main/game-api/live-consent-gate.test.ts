import { CONSENT_TEXT } from '@bombfarm/game-api';
import type { ConsentRecord } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import type { ConsentStore } from './consent-store.js';
import { createLiveConsentGate } from './live-consent-gate.js';

const GRANTED_AT = '2026-08-12T13:15:38.000Z';

function storeHolding(record: ConsentRecord): ConsentStore {
  return { read: () => record, write: () => undefined };
}

describe('the live tap consent gate', () => {
  it('permits attaching for a grant at the current disclosure version', () => {
    const gate = createLiveConsentGate(
      storeHolding({ decision: 'granted', grantedAt: GRANTED_AT, textVersion: CONSENT_TEXT.version }),
    );
    expect(gate()).toBe(true);
  });

  it('refuses a grant that predates the current disclosure, which never mentioned attaching', () => {
    const gate = createLiveConsentGate(
      storeHolding({ decision: 'granted', grantedAt: GRANTED_AT, textVersion: CONSENT_TEXT.version - 1 }),
    );
    expect(gate()).toBe(false);
  });

  it('refuses a grant stamped with a version this build does not understand', () => {
    const gate = createLiveConsentGate(
      storeHolding({ decision: 'granted', grantedAt: GRANTED_AT, textVersion: CONSENT_TEXT.version + 1 }),
    );
    expect(gate()).toBe(false);
  });

  it('refuses every decision that is not a grant', () => {
    for (const decision of ['unasked', 'declined', 'revoked'] as const) {
      const gate = createLiveConsentGate(storeHolding({ decision, textVersion: CONSENT_TEXT.version }));
      expect(gate(), decision).toBe(false);
    }
  });

  it('refuses when there is no store to read, rather than defaulting open', () => {
    expect(createLiveConsentGate(null)()).toBe(false);
  });

  it('re-reads the store on every call, so a revoke takes effect without a restart', () => {
    let record: ConsentRecord = { decision: 'granted', grantedAt: GRANTED_AT, textVersion: CONSENT_TEXT.version };
    const gate = createLiveConsentGate({ read: () => record, write: () => undefined });

    expect(gate()).toBe(true);
    record = { decision: 'revoked', textVersion: CONSENT_TEXT.version };
    expect(gate()).toBe(false);
  });
});
