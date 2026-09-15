import type { AccountSection } from '@bombfarm/contracts';
import { checkSectionShape, SECTION_FINGERPRINTS } from '@bombfarm/game-api';

export type SectionDropVerdict =
  | { readonly drop: false }
  | { readonly drop: true; readonly triggers: readonly string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A stored `skills` section body predates the 2026-08-13 game patch — and must be dropped, never
 * served — when it fails `SECTION_FINGERPRINTS.skills` with an unexpected ADDED key. A POSITIVE
 * test on things that ARE there: a section missing new post-patch keys is deliberately never a
 * trigger here; that "are the new keys present" question belongs to the export accept/reject
 * gate (`missingPostUpdateKeys`), not to this best-effort, never-throws storage read.
 *
 * The fingerprint trigger is scoped to `skills` only, not every section: the 2026-08-13 patch
 * changed exactly one section's schema (`skills.totals`/`skills.refunds`) — `account`/`heroes`/
 * `casa`/`items` never drifted, so a generic fingerprint check on them could only ever produce
 * false positives against this codebase's own long-standing partial/synthetic stored bodies
 * (`account-store-persist.test.ts`, `legacy-snapshot.test.ts`, `account-refresh.test.ts`, …:
 * `AccountStore` performs no normalization of its own and never required those bodies to be
 * schema-complete). `triggers` is a list of path-qualified key names only — never a stored value.
 */
function skillsShapeTriggers(section: AccountSection, body: unknown): string[] {
  if (section !== 'skills') return [];
  const shape = checkSectionShape(body, SECTION_FINGERPRINTS.skills);
  return shape.ok ? [] : [...shape.addedKeys];
}

/**
 * The same positive-check style, but for a DIFFERENT contract change: a stored `casa` row written before
 * the `/rotation` route started yielding its whole body holds the bare house object directly
 * (no nested `casa` key) — under the current contract that shape reads as a rotation body that
 * lost `field_size`/`heroes`/`rescues_left`/`rescues_max`, four of its five keys, which is exactly
 * the "plausible wrong number" `D24` exists to prevent. A POSITIVE structural check only: it
 * looks for the nested house object the current contract requires, never at what is missing
 * elsewhere in the body, so it never mistakes an otherwise-valid partial/synthetic stored `casa`
 * body (this store's own test suite seeds several) for a pre-contract row.
 */
function isPreContractCasaBody(section: AccountSection, body: unknown): boolean {
  return section === 'casa' && isObject(body) && !isObject(body.casa);
}

export function judgeStoredSection(section: AccountSection, body: unknown): SectionDropVerdict {
  const triggers: string[] = [...skillsShapeTriggers(section, body)];

  if (isPreContractCasaBody(section, body)) {
    triggers.push('casa.casa');
  }

  if (triggers.length === 0) return { drop: false };
  return { drop: true, triggers };
}
