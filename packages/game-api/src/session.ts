import { isGranted } from './consent.js';
import type { GrantedConsent } from './consent.js';

/**
 * `SessionToken` — the credential value that must never leak (`AD-028`, `LAR-12`). Redaction is a
 * property of the *type*: `toString`, `toJSON` and the Node `util.inspect` custom hook all render
 * `'[redacted]'`, and the raw value lives in a true private class field (`#value`) so it is not an
 * own enumerable property — `Object.keys`, `Object.entries` and object spread all expose nothing.
 *
 * The one legitimate reader is `request.ts`, which reaches the raw string by calling the
 * module-private `RAW` symbol-keyed method below (`token[RAW]()`) — reachable only by importing
 * this exact symbol reference, not by name, and not by any reflection API: it is a plain method,
 * not a `get` accessor, specifically so `util.inspect`'s `getters: true` option (which evaluates
 * accessor properties) cannot trigger it into printing the raw value.
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

  /** @internal — read only by `request.ts`, and only through the module-private `RAW` symbol.
   *  Deliberately a plain method, not a `get` accessor: `util.inspect(token, { customInspect:
   *  false, showHidden: true, getters: true })` evaluates *accessor* properties and prints their
   *  return value — `#value` itself stays a true private field and is never reachable that way,
   *  but the old `get [RAW]()` accessor was itself an evaluable property under those three
   *  options together, which leaked the raw value through it even though no call site in this
   *  codebase currently sets all three (grepped; zero hits — this was latent, not live). A plain
   *  method is only ever *called*, never evaluated by `util.inspect`, so `showHidden: true`
   *  prints it as `[Function: [RAW]]` at most, closing this reflection surface too. */
  [RAW](): string {
    return this.#value;
  }

  /** Lets a log or frame-ring redactor neutralize this token in text it does not control, without
   *  ever handing the raw value back to the caller — the raw value never leaves the class. */
  redactFrom(text: string): string {
    return text.split(this.#value).join('[redacted]');
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

/**
 * Not exported as a value — only the `ConsentedSession` type alias below leaves this module, so
 * no external caller can ever write `new ConsentedSessionRecord(...)`, `instanceof
 * ConsentedSessionRecord`, or otherwise name this class. The capability itself is enforced by the
 * `#brand` private field: a **true** ES private class field, not the `CONSENTED_BRAND`
 * symbol-keyed property this replaces. The symbol version was defeated by brand-symbol
 * harvesting — `Object.getOwnPropertySymbols(realSession)` reads a symbol key straight off any
 * live session (no import of the symbol's name required), and that harvested symbol can then be
 * stamped onto an attacker-controlled plain object literal (`{ ...] as unknown as
 * ConsentedSession }`), which `isConsentedSession` then accepted. A private field cannot be
 * harvested (`Object.getOwnPropertySymbols`/`getOwnPropertyNames` never lists it), copied (object
 * spread and `Object.assign` skip it, same as `SessionToken#value`), or stamped onto a
 * pre-existing object at all — there is no syntax that adds a private field to an object after
 * the fact from outside the declaring class. This is exactly `SessionToken#value`'s pattern,
 * copied rather than reinvented (`AD-025`, `AD-028`, `TD-2`).
 */
class ConsentedSessionRecord {
  readonly accountId: string;
  readonly token: SessionToken;
  readonly grantedAt: string;
  readonly #brand = true;

  constructor(accountId: string, token: SessionToken, grantedAt: string) {
    this.accountId = accountId;
    this.token = token;
    this.grantedAt = grantedAt;
  }

  /** True only for a value that itself carries this class's private `#brand` field — i.e. was
   *  built by this constructor, which only `grantSession` below ever calls. Uses the ergonomic
   *  `in` brand check (`#brand in value`) rather than `instanceof`: `instanceof` only inspects
   *  the prototype chain, which `Object.setPrototypeOf` can spoof, while `#brand in value`
   *  inspects the object's own private-field slot directly and cannot be spoofed by any means. */
  static hasBrand(value: unknown): value is ConsentedSessionRecord {
    return typeof value === 'object' && value !== null && #brand in value;
  }
}

/**
 * The capability. There is no value of this type reachable except through `grantSession`, and
 * `grantSession` only accepts a `granted` consent record — "no call before consent" is therefore
 * a type, not a rule anyone has to remember (`AD-025`, `TD-2`).
 */
export type ConsentedSession = ConsentedSessionRecord;

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
  return new ConsentedSessionRecord(creds.accountId, creds.token, consent.grantedAt);
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
 * The runtime half of the brand: `true` only for a value that actually carries
 * `ConsentedSessionRecord`'s true private `#brand` field, plus the shape `grantSession` always
 * produces. Unlike the `CONSENTED_BRAND` symbol-keyed property this replaces, a value forged with
 * an unsafe cast cannot satisfy `ConsentedSessionRecord.hasBrand` by any means — not by naming a
 * symbol, not by harvesting one off a live session with `Object.getOwnPropertySymbols`, and not
 * by copying one via spread — because a private field can only ever be installed by that class's
 * own constructor, which this module never exposes outside `grantSession`.
 */
export function isConsentedSession(value: unknown): value is ConsentedSession {
  if (!ConsentedSessionRecord.hasBrand(value)) {
    return false;
  }
  return (
    typeof value.accountId === 'string' &&
    typeof value.grantedAt === 'string' &&
    value.token instanceof SessionToken
  );
}
