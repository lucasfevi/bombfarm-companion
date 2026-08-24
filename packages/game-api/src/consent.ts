import type { ConsentDecision, ConsentRecord } from '@bombfarm/contracts';
import { CONSENT_TEXT } from './consent-text.js';

/**
 * Consent — the pure state machine (LAR-01, LAR-03…05). No I/O, no clock: `now` is injected by
 * the caller (`account-refresh.ts` in `apps/desktop`), never read here.
 *
 * `ConsentDecision`/`ConsentRecord` are defined in `@bombfarm/contracts`, not here — they cross
 * the desktop main<->renderer IPC boundary (T9), and `AGENTS.md` makes contracts the one home
 * for IPC types. See `packages/contracts/src/consent.ts`'s doc comment for why the dependency
 * runs this direction (game-api -> contracts, type-only) and not the reverse.
 */
export type { ConsentDecision, ConsentRecord };

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
 * Defined as the negation of `isGranted` for anything claiming to be granted, so the modal and the
 * read gate can never disagree: whatever `isGranted` rejects is something the player still has to
 * be asked about, including a record whose `grantedAt` is missing.
 */
export function shouldShowConsentModal(record: ConsentRecord): boolean {
  if (record.decision === 'unasked') return true;
  return record.decision === 'granted' && !isGranted(record);
}

/**
 * The type guard `grantSession` (T2) requires before it can even attempt a runtime construction.
 * Strict equality on `textVersion`, not `>=`: a record stamped with a version newer than this
 * build understands must also fail, so a downgraded build re-prompts instead of assuming a grant
 * it cannot have shown.
 */
export function isGranted(record: ConsentRecord): record is GrantedConsent {
  return (
    record.decision === 'granted' &&
    typeof record.grantedAt === 'string' &&
    record.textVersion === CONSENT_TEXT.version
  );
}
