import type { AccountSection } from '@bombfarm/contracts';
import { ROUTE_FINGERPRINTS, type RouteFingerprint } from './fingerprints.js';
import { checkShape } from './shape.js';
import { isPlainObject } from './type-guards.js';

/**
 * The interceptor hooks the client's TLS read side, so an observed body never carries a URL or a
 * method — {@link ROUTE_FINGERPRINTS}'s strict, complete key sets are the only thing left to
 * identify it by. A body is `identified` only when it matches exactly one route; `unidentified`
 * (no match, the expected outcome after a game patch reshapes a body) and `ambiguous` (more than
 * one match) are both refusals to guess, never resolved by preferring one route over another.
 */
export type ObservedBodyIdentification =
  | { readonly kind: 'identified'; readonly section: AccountSection }
  | { readonly kind: 'unidentified' }
  | { readonly kind: 'ambiguous'; readonly sections: readonly AccountSection[] };

export function identifyObservedBody(
  body: unknown,
  fingerprints: Readonly<Record<AccountSection, RouteFingerprint>> = ROUTE_FINGERPRINTS,
): ObservedBodyIdentification {
  if (!isPlainObject(body)) return { kind: 'unidentified' };

  const sections = Object.keys(fingerprints) as readonly AccountSection[];
  const matches = sections.filter((section) => checkShape(body, fingerprints[section]).ok);

  if (matches.length === 0) return { kind: 'unidentified' };
  if (matches.length === 1) return { kind: 'identified', section: matches[0] as AccountSection };
  return { kind: 'ambiguous', sections: matches };
}
