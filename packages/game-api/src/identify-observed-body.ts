import type { AccountSection } from '@bombfarm/contracts';
import { ROUTE_FINGERPRINTS, type RouteFingerprint } from './fingerprints.js';
import { identifyPvpBody, type PvpRoute } from './pvp/identify.js';
import { checkShape } from './shape.js';
import { isPlainObject } from './type-guards.js';

/**
 * The interceptor hooks the client's TLS read side, so an observed body never carries a URL or a
 * method — {@link ROUTE_FINGERPRINTS}'s strict, complete key sets are the only thing left to
 * identify it by. A body is `identified` only when it matches exactly one route; `unidentified`
 * (no match, the expected outcome after a game patch reshapes a body) and `ambiguous` (more than
 * one match) are both refusals to guess, never resolved by preferring one route over another.
 *
 * `pvp` is the one non-section verdict: a duel result or a film, told apart by the key pair only
 * each carries (see {@link identifyPvpBody}). A section fingerprint names a complete key set that
 * contains neither pair, so a body can never be both a section and a PVP body.
 */
/**
 * Why an `unidentified` verdict happened, when the answer is "the game added a key".
 *
 * A complete-key fingerprint rejects a whole body for one addition, and the rejection is silent:
 * the section simply stops being read. That has now happened twice — the sell-gate keys, then
 * `rune_stash` on the account body and `export_lock_secs` on inventory items, which between them
 * cost 2,130 discarded bodies over a six-hour observation before anyone noticed. Nothing in the
 * app distinguished those from the genuinely unknown routes it also sees, so the log line that
 * would have named the problem on day one read the same as ordinary noise.
 *
 * The signature of drift is narrow and worth stating exactly: the body carries **every** key the
 * route requires and some the fingerprint does not declare — `missingKeys` empty, `addedKeys` not.
 * An unrelated route is missing most of what a fingerprint requires, so it never reaches here.
 */
export interface ObservedBodyDrift {
  readonly section: AccountSection;
  readonly addedKeys: readonly string[];
}

export type ObservedBodyIdentification =
  | { readonly kind: 'identified'; readonly section: AccountSection }
  | { readonly kind: 'pvp'; readonly route: PvpRoute }
  | { readonly kind: 'unidentified' }
  | { readonly kind: 'ambiguous'; readonly sections: readonly AccountSection[] };

export function identifyObservedBody(
  body: unknown,
  fingerprints: Readonly<Record<AccountSection, RouteFingerprint>> = ROUTE_FINGERPRINTS,
): ObservedBodyIdentification {
  if (!isPlainObject(body)) return { kind: 'unidentified' };

  const pvpRoute = identifyPvpBody(body);
  if (pvpRoute !== null) return { kind: 'pvp', route: pvpRoute };

  const sections = Object.keys(fingerprints) as readonly AccountSection[];
  const matches = sections.filter((section) => checkShape(body, fingerprints[section]).ok);

  if (matches.length === 0) return { kind: 'unidentified' };
  if (matches.length === 1) return { kind: 'identified', section: matches[0] as AccountSection };
  return { kind: 'ambiguous', sections: matches };
}

/**
 * Names the routes an unidentified body is a drifted form of. Empty for a body that is genuinely
 * some other route, which is the common case and must stay quiet.
 *
 * Deliberately reports every candidate rather than picking one: two sections both matching on a
 * superset is itself worth seeing, and preferring one would be the guess this module refuses to
 * make everywhere else.
 */
export function diagnoseObservedBodyDrift(
  body: unknown,
  fingerprints: Readonly<Record<AccountSection, RouteFingerprint>> = ROUTE_FINGERPRINTS,
): readonly ObservedBodyDrift[] {
  if (!isPlainObject(body)) return [];

  const drifted: ObservedBodyDrift[] = [];
  for (const section of Object.keys(fingerprints) as readonly AccountSection[]) {
    const result = checkShape(body, fingerprints[section]);
    if (result.ok) continue;
    if (result.missingKeys.length > 0) continue;
    drifted.push({ section, addedKeys: result.addedKeys });
  }
  return drifted;
}
