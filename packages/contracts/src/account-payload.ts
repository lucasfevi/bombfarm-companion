/** The five independently-resolvable sections of an account payload (AD-019 rule 3). */
export type AccountSection = 'account' | 'heroes' | 'skills' | 'casa' | 'items';

/**
 * `resolved` — read in this capture. `stale` — last-known-good, older than this capture.
 * `missing` — never seen, or not recoverable at all. `degraded` — the source answered with a
 * shape that no longer matches its fingerprint (LAR-19); the body is carried alongside the status
 * regardless, but it is only trustworthy when nothing this section reads was lost — see
 * `isTrustworthySection` for the added-vs-missing distinction that decides that.
 */
export type SectionStatus = 'resolved' | 'stale' | 'missing' | 'degraded';

/** ISO-8601 `capturedAt` is required for anything that is not `missing` (ACS-04). */
export type SectionFidelity =
  | { readonly status: 'resolved' | 'stale'; readonly capturedAt: string }
  | { readonly status: 'missing'; readonly capturedAt?: undefined }
  | {
      readonly status: 'degraded';
      readonly capturedAt: string;
      /** Fingerprint keys the response did not carry — named so a game update is diagnosable
       *  from a user's log without a debugger (LAR-19/LAR-20). */
      readonly missingKeys: readonly string[];
      /** MP5 F4: fingerprint keys the response carried that were NOT declared — named for the
       *  same reason `missingKeys` is. Required, not optional: an incomplete drift report (one
       *  collection present, the other silently dropped) becomes unrepresentable. */
      readonly addedKeys: readonly string[];
    };

/**
 * Whether a `degraded` section's body is safe to compute from. An added key is a game update we
 * do not read yet — harmless. A missing key is a field this repo declares gone, and a parser can
 * silently substitute a default in its place — not safe, even though a body was returned.
 */
export function isTrustworthySection(fidelity: Extract<SectionFidelity, { readonly status: 'degraded' }>): boolean {
  return fidelity.missingKeys.length === 0;
}

export type AccountFidelity = { readonly [S in AccountSection]: SectionFidelity };

export type AccountFidelityGrade = 'full' | 'degraded' | 'unavailable';

export interface AccountFidelityReport {
  readonly grade: AccountFidelityGrade;
  /** Every non-`resolved` section, in `ACCOUNT_SECTIONS` order. Empty iff grade is `full`. */
  readonly degradedSections: readonly AccountSection[];
}

/**
 * Source-neutral account data. Deliberately carries NO `export_version` and NO
 * `generated_at` — the authenticated read path provably never retains them,
 * and a field only one source can populate is a lie in the type.
 *
 * Section bodies stay loosely typed: the parser is defensive by design and
 * re-validates every field. Producers get the key names; they get no licence to
 * skip validation downstream.
 */
export interface AccountPayload {
  /** `/state`-derived scalars. Only `phase` is read by F1. */
  readonly account?: Record<string, unknown> | undefined;
  /** `/roster` heroes. Absent or non-array ⇒ `notASaveFile`. */
  readonly heroes?: readonly unknown[] | undefined;
  /** `/skill/state`. `skills.totals` drives the tree. */
  readonly skills?: Record<string, unknown> | undefined;
  /** `/rotation`'s whole body — `field_size`, `heroes` (per-hero rotation state), `casa` (the
   *  house object: `active_casa`, `levels`, `slots`, …), `rescues_left`, `rescues_max`. A save
   *  export's `casa` key carries the house object directly instead (no wrapping route body);
   *  readers that need the house resolve either shape (`import-save.ts`'s single read site). */
  readonly casa?: Record<string, unknown> | undefined;
  /** `/inventory` items. Absent ⇒ the "no items list" warning, then parsing continues. */
  readonly items?: readonly unknown[] | undefined;
  /** Absent means "not asserted" and grades as `full` (ACS-05.5 — the file adapter's case). */
  readonly fidelity?: AccountFidelity | undefined;
}
