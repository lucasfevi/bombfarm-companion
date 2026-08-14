import type { AccountSection } from '@bombfarm/contracts';
import { checkSectionShape, SECTION_FINGERPRINTS } from '@bombfarm/game-api';

/**
 * MP5 F4 (T10, `AD-089`) — the desktop's half of the stale-data drop. The web's
 * `stale-account.ts` carries the `TreeState` field vocabulary over the SAME dead keystone
 * mechanic; this file carries the raw SAVE vocabulary a pre-patch `skills` row still holds.
 * They are DIFFERENT vocabularies over the same retired mechanic, not copies of each other
 * (design §2.8) — no parity guard between them is meaningful, and none is added.
 */
export const RETIRED_TOTALS_KEYS = ['keystones', 'abisso_base', 'crit_dmg_mult'] as const;

export type SectionDropVerdict =
  | { readonly drop: false }
  | { readonly drop: true; readonly triggers: readonly string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `MSG-19`: presence, not truthiness (the web drop's own rule, `MSG-21`) — `key in totals`,
 *  never `totals[key]`. Only the `skills` section carries this vocabulary; every other section
 *  relies solely on the fingerprint trigger below. */
function retiredKeyTriggers(section: AccountSection, body: unknown): string[] {
  if (section !== 'skills' || !isObject(body)) return [];
  const totals = body.totals;
  if (!isObject(totals)) return [];
  const hits: string[] = [];
  for (const key of RETIRED_TOTALS_KEYS) {
    if (key in totals) hits.push(`skills.totals.${key}`);
  }
  return hits;
}

/**
 * `MSG-19`/`MSG-20`: a stored `skills` section body predates the 2026-08-13 game patch — and
 * must be dropped, never served — when it carries a retired `skills.totals` key (path-qualified
 * presence) **or** fails `SECTION_FINGERPRINTS.skills` with an unexpected ADDED key. Both
 * triggers are POSITIVE tests on things that ARE there (design §5.5) — a section missing new
 * post-patch keys is deliberately never a trigger here; that "are the new keys present" question
 * belongs to the export accept/reject gate (`MSG-11`…`MSG-18`, `missingPostUpdateKeys`), not to
 * this best-effort, never-throws storage read.
 *
 * The fingerprint trigger is scoped to `skills` only, not every section: the 2026-08-13 patch
 * changed exactly one section's schema (`skills.totals`/`skills.refunds`) — `account`/`heroes`/
 * `casa`/`items` never drifted, so a generic fingerprint check on them could only ever produce
 * false positives against this codebase's own long-standing partial/synthetic stored bodies
 * (`account-store-persist.test.ts`, `legacy-snapshot.test.ts`, `account-refresh.test.ts`, …:
 * `AccountStore` performs no normalization of its own and never required those bodies to be
 * schema-complete). `triggers` is a list of path-qualified key names only — never a stored value
 * (`MSG-28`).
 *
 * A retired `skills.totals` key is, by construction, ALSO an unrecognized key under the exact-
 * match schema check (`checkSchema` descends into `totals` and flags any key `SKILLS_TOTALS_LEVEL`
 * doesn't declare) — so an unfiltered fingerprint check would always re-find the same evidence
 * the retired-key branch already reported, making the retired-key branch dead in practice: it
 * could be deleted and no verdict would ever change. `sanitizeForFingerprint` strips the retired
 * keys out of `totals` before the fingerprint check runs, so a body whose ONLY drift is a retired
 * key genuinely passes `checkSectionShape` (`shape.ok === true`) — the retired-key branch is then
 * the sole, independent cause of that body's drop.
 */
function sanitizeForFingerprint(body: unknown): unknown {
  if (!isObject(body) || !isObject(body.totals)) return body;
  const retired: readonly string[] = RETIRED_TOTALS_KEYS;
  const cleanTotals = Object.fromEntries(
    Object.entries(body.totals).filter(([key]) => !retired.includes(key)),
  );
  return { ...body, totals: cleanTotals };
}

export function judgeStoredSection(section: AccountSection, body: unknown): SectionDropVerdict {
  const triggers: string[] = [...retiredKeyTriggers(section, body)];

  if (section === 'skills') {
    const shape = checkSectionShape(sanitizeForFingerprint(body), SECTION_FINGERPRINTS.skills);
    if (!shape.ok) {
      triggers.push(...shape.addedKeys);
    }
  }

  if (triggers.length === 0) return { drop: false };
  return { drop: true, triggers };
}
