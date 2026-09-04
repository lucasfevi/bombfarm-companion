import { ConsentedSessionRequiredError, isConsentedSession, type ConsentedSession } from './session.js';

/**
 * `WriteSession` — the capability to make the app's one kind of write, a forge roll. It is the
 * same shape as `ConsentedSession` one layer up: a class with a true private `#brand` field that
 * is never exported as a value, minted only by `grantWriteSession`, and re-checked at runtime by
 * `isWriteSession` in `forge-request.ts` before a token is ever read. `session.ts` explains why a
 * private field and not a symbol; nothing here is different.
 *
 * A write session *contains* the consented session it was minted from, so consent is a
 * prerequisite by type, and the "Let Forge spend gold" switch is a prerequisite by the only
 * constructor — two independent mechanisms, neither of which anyone has to remember.
 */

/** Thrown when `grantWriteSession` is reached with the switch off — the only constructor refuses,
 *  so no `WriteSession` value can exist while the setting is `false`. */
export class WriteNotEnabledError extends Error {
  constructor() {
    super('WriteNotEnabledError: forge writes are off in Settings ("Let Forge spend gold")');
    this.name = 'WriteNotEnabledError';
  }
}

/** Thrown at runtime when `forge-request.ts` is handed a value typed as `WriteSession` that was
 *  not minted by `grantWriteSession` — the write-side twin of `ConsentedSessionRequiredError`. */
export class WriteSessionRequiredError extends Error {
  constructor() {
    super('WriteSessionRequiredError: requestPost/buildForgeRequest require a session minted by grantWriteSession');
    this.name = 'WriteSessionRequiredError';
  }
}

class WriteSessionRecord {
  readonly session: ConsentedSession;
  readonly #brand = true;

  constructor(session: ConsentedSession) {
    this.session = session;
  }

  static hasBrand(value: unknown): value is WriteSessionRecord {
    return typeof value === 'object' && value !== null && #brand in value;
  }
}

export type WriteSession = WriteSessionRecord;

/** Exactly `true`, read as `unknown` so a value that bypassed the type system — a string, a
 *  number, a missing field — is off rather than truthy. */
function isSwitchOn(value: unknown): value is true {
  return value === true;
}

/**
 * The ONLY constructor for `WriteSession`. Refuses a session that was not minted by
 * `grantSession` (the consent brand, checked at runtime as well as by type) and refuses unless
 * `forgeWritesEnabled` is exactly `true` — the switch is off by default, and a missing or
 * non-boolean value is off.
 */
export function grantWriteSession(
  session: ConsentedSession,
  settings: { readonly forgeWritesEnabled: boolean },
): WriteSession {
  if (!isConsentedSession(session)) {
    throw new ConsentedSessionRequiredError();
  }
  if (!isSwitchOn(settings.forgeWritesEnabled)) {
    throw new WriteNotEnabledError();
  }
  return new WriteSessionRecord(session);
}

/** The runtime half of the brand: `true` only for a value built by `grantWriteSession`, whose
 *  inner session still carries `grantSession`'s own brand. */
export function isWriteSession(value: unknown): value is WriteSession {
  return WriteSessionRecord.hasBrand(value) && isConsentedSession(value.session);
}
