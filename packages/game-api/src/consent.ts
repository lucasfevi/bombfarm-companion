import { CONSENT_TEXT } from './consent-text.js';

/**
 * Consent — the pure state machine (LAR-01, LAR-03…05). No I/O, no clock: `now` is injected by
 * the caller (`account-refresh.ts` in `apps/desktop`), never read here.
 */
export type ConsentDecision = 'unasked' | 'granted' | 'declined' | 'revoked';

export interface ConsentRecord {
  readonly decision: ConsentDecision;
  /** Present iff decision === 'granted'. */
  readonly grantedAt?: string;
  /** The CONSENT_TEXT version the player actually saw when this decision was recorded. */
  readonly textVersion: number;
}

/** The narrowed record `grantSession` (T2) accepts — `grantedAt` is required, not optional. */
export interface GrantedConsent extends ConsentRecord {
  readonly decision: 'granted';
  readonly grantedAt: string;
}

export type ConsentEvent =
  | { readonly type: 'accept'; readonly now: string }
  | { readonly type: 'decline' }
  | { readonly type: 'revoke' };

/** A fresh consent record: nothing asked yet, stamped with the disclosure text version in force. */
export function initialConsent(): ConsentRecord {
  return { decision: 'unasked', textVersion: CONSENT_TEXT.version };
}

/**
 * Every legal transition, `now` injected:
 * `unasked -> granted | declined`; `granted -> revoked`; `declined -> granted`
 * (the player may change their mind); `revoked -> granted`.
 */
export function reduceConsent(record: ConsentRecord, event: ConsentEvent): ConsentRecord {
  switch (event.type) {
    case 'accept':
      return { decision: 'granted', grantedAt: event.now, textVersion: CONSENT_TEXT.version };
    case 'decline':
      return { decision: 'declined', textVersion: CONSENT_TEXT.version };
    case 'revoke':
      return { decision: 'revoked', textVersion: record.textVersion };
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/**
 * Unasked always shows the modal. A `granted` record whose `textVersion` predates the current
 * `CONSENT_TEXT.version` shows it again — a new disclosure cannot ride on an old agreement.
 */
export function shouldShowConsentModal(record: ConsentRecord): boolean {
  if (record.decision === 'unasked') return true;
  if (record.decision === 'granted' && record.textVersion < CONSENT_TEXT.version) return true;
  return false;
}

/** The type guard `grantSession` (T2) requires before it can even attempt a runtime construction. */
export function isGranted(record: ConsentRecord): record is GrantedConsent {
  return record.decision === 'granted' && typeof record.grantedAt === 'string';
}
