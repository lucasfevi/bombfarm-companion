/**
 * Consent decision state (mp2-live-account-read, LAR-01, LAR-03…05). Owned here — not in
 * `@bombfarm/game-api`, where the reducer that operates on it lives — because it crosses the
 * `apps/desktop` main↔renderer IPC boundary (`consent:get`/`accept`/`decline`/`revoke` results,
 * `consent:changed` events) and `AGENTS.md` makes `@bombfarm/contracts` the one home for IPC
 * types both processes import from.
 *
 * SPEC_DEVIATION: design.md §4.2 frames this type as "declared in packages/game-api, re-exported
 * from @bombfarm/contracts". Literally re-exporting FROM game-api would require contracts to
 * depend on game-api for the type — but game-api already depends on contracts for
 * `AccountSection`, so that would be a circular package dependency neither `tsc` nor `pnpm -r
 * build`'s topological ordering can resolve. Reason: this type is the canonical definition, and
 * `packages/game-api/src/consent.ts` imports it back type-only — the same AD-020 shape
 * (consumer -> contracts, type-only), applied in the direction that actually builds.
 */
import type { AppLocale } from './locale.js';

export type ConsentDecision = 'unasked' | 'granted' | 'declined' | 'revoked';

export interface ConsentRecord {
  readonly decision: ConsentDecision;
  /** Present iff decision === 'granted'. */
  readonly grantedAt?: string;
  /** The disclosure text version the player actually saw when this decision was recorded. */
  readonly textVersion: number;
  /** The language the disclosure was rendered in when this decision was recorded. Optional: a
   *  record written before this field existed carries no locale, and is still valid — this is
   *  provenance, not part of what `isGranted` checks. */
  readonly textLocale?: AppLocale;
}
