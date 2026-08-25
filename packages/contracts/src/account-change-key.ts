import type { AccountFidelity, AccountPayload, AccountSection } from './account-payload.js';

/**
 * `accountChangeKey` — tier 0 of MP3 F3's two-tier change detection (design.md `AD-044`). It
 * gates **both** main's `account:changed` emit and the renderer's accept gate with the same
 * answer to "did anything in this `AccountPayload` actually change?"
 *
 * Declared locally rather than imported from `@bombfarm/domain`'s `account-fidelity.ts` — the
 * **order** is the contract both processes must agree on, and importing domain here would
 * invert the dependency this package is required to keep at zero (`packages/contracts/package.json`
 * has only `typescript`/`vitest` as devDependencies; `@bombfarm/domain` is required to import
 * this package type-only, never the other way — see
 * `packages/domain/tests/contracts-import-is-type-only.test.ts`). Both processes already agree
 * on this order independently: it is `@bombfarm/domain/account-fidelity.ts`'s own
 * `ACCOUNT_SECTIONS` constant, restated here.
 */
const ACCOUNT_SECTIONS: readonly AccountSection[] = ['account', 'heroes', 'skills', 'casa', 'items'];

/**
 * Recursively sorts object keys so two structurally-identical values serialise identically
 * regardless of property insertion order. Arrays keep their own order — order is meaningful
 * there (e.g. `heroes[]`), unlike object key order, which carries no information at all.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      out[key] = canonicalize(record[key]);
    }
    return out;
  }
  return value;
}

/**
 * An order-independent identity string for a JSON-shaped value — the shared building block behind
 * both this module's own {@link accountChangeKey} and the boundary log's dedup key
 * (`apps/desktop/src/main/boundary-log/dedup.ts`). Delegates to `JSON.stringify` on the
 * canonicalized value, so an explicit `undefined` property is dropped rather than serialised —
 * `JSON.stringify`'s own behaviour for object properties.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * A `capturedAt`-blind, canonical change key over an `AccountPayload`.
 *
 * **Same key** implies the five section bodies, statuses, `missingKeys` and presence are all
 * structurally identical — and, because `parseAccountPayload` is pure (`import-save.ts` has
 * zero `Date.now`/`Math.random`/`performance.now` calls, design.md §2.5), every value
 * `pipelineForHero` would derive from the payload is identical too. **Different key** does not
 * imply a *planning-relevant* difference — tier 1 (`heroChangeKey`/`sharedChangeKey` in
 * `hero-advice.ts`) is the exact answer to that question. This tier's only job is to never miss
 * a real change: it may false-positive (cheap — one recompute), it must never false-negative
 * (expensive — a silently stale number, the `D24` failure).
 *
 * `capturedAt` is never read here — not filtered out downstream, never reached at all. It is the
 * only timestamp an `AccountPayload` carries (`account-payload.ts`'s own doc comment) and it
 * carries zero planning information; reading it would make every poll cycle look like a change
 * (`AD-031`).
 *
 * `AccountView.gameRunning` cannot leak into this key even by accident: the function's only
 * input is `payload`, and `gameRunning` is not a field of `AccountPayload` at all — it lives on
 * `AccountView`, one level up (MAR-05).
 *
 * **Canonical, not insertion-order.** A producer that re-materialises a section body with a
 * different key order (same values) must not look like a change — an insertion-order key would
 * make it one, silently failing MAR-04 while every "a change is detected" test stays green
 * (design.md §2.4's last probe, `AD-044`).
 */
export function accountChangeKey(payload: AccountPayload): string {
  const fidelity: AccountFidelity | undefined = payload.fidelity;
  const untyped = payload as unknown as Record<string, unknown>;

  const parts = ACCOUNT_SECTIONS.map((section) => {
    // `'section' in payload` — distinct from "the value is undefined" (assemble.ts's own
    // distinction between an absent key and an explicit undefined; D24/LAR-10 is why it matters
    // here too: a section that was never asserted must key differently from one asserted empty).
    const present = section in untyped;
    const sectionFidelity = fidelity?.[section];
    const status = sectionFidelity?.status ?? 'missing';
    const missingKeys =
      sectionFidelity && sectionFidelity.status === 'degraded' ? sectionFidelity.missingKeys : [];
    // MP5 F4: folded in alongside missingKeys — a drift whose ADDED set changes (a game update
    // adds yet another undeclared key) must also re-emit a change (AD-044: may false-positive,
    // must never false-negative).
    const addedKeys =
      sectionFidelity && sectionFidelity.status === 'degraded' ? sectionFidelity.addedKeys : [];
    const body = present ? untyped[section] : undefined;
    return canonicalStringify({ section, present, status, missingKeys, addedKeys, body });
  });

  return parts.join('|');
}
