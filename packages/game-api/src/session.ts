import { isGranted } from './consent.js';
import type { GrantedConsent } from './consent.js';

/**
 * `SessionToken` — the credential value that must never leak (`AD-028`, `LAR-12`). Redaction is a
 * property of the *type*: `toString`, `toJSON` and the Node `util.inspect` custom hook all render
 * `'[redacted]'`, and the raw value lives in a true private class field (`#value`) so it is not an
 * own enumerable property — `Object.keys`, `Object.entries` and object spread all expose nothing.
 *
 * The one legitimate reader is `request.ts`, which reaches the raw string through the
 * module-private `RAW` symbol below — reachable only by importing this exact symbol reference,
 * not by name or by reflection.
 */

/** @internal — imported only by `request.ts`. Do not export this symbol beyond this package. */
export const RAW: unique symbol = Symbol('bfc.session.raw');

export class SessionToken {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static create(value: string): SessionToken {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error('SessionToken.create: token must not be empty');
    }
    return new SessionToken(trimmed);
  }

  toString(): string {
    return '[redacted]';
  }

  toJSON(): string {
    return '[redacted]';
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[redacted]';
  }

  /** @internal — read only by `request.ts`, and only through the module-private `RAW` symbol. */
  get [RAW](): string {
    return this.#value;
  }
}

/** Thrown at runtime when a caller reaches `grantSession` with a non-`granted` record without
 *  going through the type system (`AD-025`'s "independent mechanisms, not one"). */
export class ConsentRequiredError extends Error {
  constructor() {
    super('ConsentRequiredError: a game-api session requires a granted consent record');
    this.name = 'ConsentRequiredError';
  }
}

/** Not exported. The only thing that can construct a value satisfying `ConsentedSession` is this
 *  module — a well-typed external caller cannot reference this symbol to forge one. */
const CONSENTED_BRAND: unique symbol = Symbol('bfc.session.consented');

/**
 * The capability. There is no value of this type reachable except through `grantSession`, and
 * `grantSession` only accepts a `granted` consent record — "no call before consent" is therefore
 * a type, not a rule anyone has to remember (`AD-025`, `TD-2`).
 */
export interface ConsentedSession {
  readonly accountId: string;
  readonly token: SessionToken;
  readonly grantedAt: string;
  readonly [CONSENTED_BRAND]: true;
}

/**
 * The ONLY constructor for `ConsentedSession`. A `ConsentRecord` that is not statically known to
 * be `granted` fails to compile (`LAR-06`); a record that reaches here at runtime without being
 * granted — a JS caller, or a value cast through `unknown` — throws `ConsentRequiredError`.
 */
export function grantSession(
  consent: GrantedConsent,
  creds: { readonly accountId: string; readonly token: SessionToken },
): ConsentedSession {
  if (!isGranted(consent)) {
    throw new ConsentRequiredError();
  }
  return {
    accountId: creds.accountId,
    token: creds.token,
    grantedAt: consent.grantedAt,
    [CONSENTED_BRAND]: true,
  };
}

/** Thrown at runtime when `request.ts` (`buildHttpRequest`/`requestGet`) is handed a value typed
 *  as `ConsentedSession` that was not actually minted by `grantSession` — e.g. a value forged
 *  with `{ ... } as unknown as ConsentedSession`. This applies the same "type AND runtime, not
 *  type OR runtime" pattern `AD-025`/`AD-028` already apply to `grantSession` itself, one hop
 *  downstream, at the layer that actually reads the token and builds the outbound request. */
export class ConsentedSessionRequiredError extends Error {
  constructor() {
    super('ConsentedSessionRequiredError: requestGet/buildHttpRequest require a session minted by grantSession');
    this.name = 'ConsentedSessionRequiredError';
  }
}

/**
 * The runtime half of the brand: `true` only for a value that actually carries the
 * module-private `CONSENTED_BRAND` symbol key set to `true`, plus the shape `grantSession`
 * always produces. A value forged with an unsafe cast cannot even name `CONSENTED_BRAND` (it is
 * not exported), so it can imitate every *named* field of `ConsentedSession` and still fail this
 * check — the same guarantee the type system gives a well-typed caller, now checked at runtime
 * for a caller that bypassed the type system.
 */
export function isConsentedSession(value: unknown): value is ConsentedSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<PropertyKey, unknown>;
  return (
    candidate[CONSENTED_BRAND] === true &&
    typeof candidate.accountId === 'string' &&
    typeof candidate.grantedAt === 'string' &&
    candidate.token instanceof SessionToken
  );
}
