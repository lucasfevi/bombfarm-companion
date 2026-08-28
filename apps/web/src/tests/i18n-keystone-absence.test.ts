import { describe, expect, it } from 'vitest';
import { STRINGS } from '@/shared/i18n';

/**
 * The 12 keys that feature deleted. Kept here as a standalone, permanent record: this
 * suite's job is "these identifiers must never come back to STRINGS", independent of whatever
 * the i18n-split-parity fixture currently looks like. It used to be imported from
 * `i18n-split-parity.test.ts`, which also used it to compute a delta against the frozen
 * fixture — but the 2026-08-17 fixture re-baseline (see that file's top comment) cleared that
 * bookkeeping, since the fresh fixture no longer contains these keys either. This list has no
 * such dependency: it is a fixed historical fact, not a diff against a moving baseline.
 */
const KEYSTONE_KEYS_REMOVED = [
  'treeGlassCannon',
  'treeGlassCannonHint',
  'treeAbisso',
  'treeAbissoHint',
  'treeTempoDobrado',
  'treeTempoDobradoHint',
  'keystoneOn',
  'keystoneOff',
  'importKeystoneOn',
  'bdNoteGlassCannon',
  'bdNoteTempoDobrado',
  'bdTermAbisso',
] as const;

// MSC-05, MSC-06 — the 12 deleted keys are gone from BOTH languages, and no *surviving*
// string in either language still names a keystone. Two of the three keystone display
// names (`Abisso`, `Glass Cannon`, `Tempo Dobrado`) are official in-game terms kept
// untranslated in both languages (docs/i18n.md rule 2), so an EN-only sweep would look
// complete while the PT hints and the Sim/Não status readouts survived — this suite scans
// both languages independently and neither can satisfy it alone.
//
// Widened later (a follow-up fix): the original regex covered the three
// field-identifier-adjacent display names removed alongside KEYSTONE_KEYS_REMOVED, but missed
// the other two retired damage-multiplier sources' display names entirely — `Juro` (O15, Juro
// Composto) and `Avalanche` (G07) shipped only inside `accountTip`'s prose, as parenthetical
// examples with no field identifier anywhere nearby, so no identifier-keyed guard elsewhere in
// this repo ever matched them. `Sorte Composta` (S15) is added for the same reason even though
// no surviving string ever named it — closing the class, not just the instance. Neither of the
// two needed any math modelling of its own — like GEO, its contribution arrived pre-folded into
// the save file's totals — so this widening is purely about stale player-facing prose, not
// unmodelled combat math. `\bjuro\b` and `\bavalanche\b` are deliberately case-insensitive
// whole-word matches: a repo-wide case-insensitive grep for both tokens against
// apps/web/src/shared/i18n turned up nothing outside this fix, so neither is a substring of any
// other live English or Portuguese word this app's copy uses — this stays a hard zero with no
// allowlist, matching this suite's existing shape.
const KEYSTONE_TERM_RE = /keystone|abisso|glass ?cannon|tempo ?dobrado|\bjuro\b|\bavalanche\b|sorte ?composta/i;

/**
 * Flatten every string value reachable from `value`, descending into plain objects and
 * arrays. STRINGS.<lang>.explainSections is an array of `{ h, p: string[] }` objects, so a
 * shallow Object.values() scan would miss the prose living inside `p[]` — measured: two of
 * the most-read keystone removals (advice.ts §1's chain and §8's Glass Cannon/Abisso
 * paragraph) live exactly there.
 */
function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) flattenStrings(v, out);
  }
  return out;
}

describe('i18n keystone absence (MSC-05/MSC-06)', () => {
  const enValues = flattenStrings(STRINGS.en);
  const ptValues = flattenStrings(STRINGS.pt);

  // Non-vacuity first: a broken/short-circuited walk must not pass by scanning nothing.
  // Floor: measured at 544 flattened string leaves per language as of this feature (both languages
  // measure identically — Strings = typeof en enforces the same key/array structure). 500
  // leaves headroom for future string additions while still catching a walk that silently
  // stopped descending into explainSections' p[] arrays (a shallow scan measures ~90).
  it('the flattened value scan is non-vacuous', () => {
    expect(enValues.length).toBeGreaterThanOrEqual(500);
    expect(ptValues.length).toBeGreaterThanOrEqual(500);
  });

  it.each(KEYSTONE_KEYS_REMOVED.flatMap((key) => (['en', 'pt'] as const).map((lang) => [key, lang] as const)))(
    '%s is absent from STRINGS.%s',
    (key, lang) => {
      expect(key in STRINGS[lang]).toBe(false);
    },
  );

  it('no surviving value in STRINGS.en matches a keystone term', () => {
    const offenders = enValues.filter((v) => KEYSTONE_TERM_RE.test(v));
    expect(offenders, `keystone-shaped EN values survived: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('no surviving value in STRINGS.pt matches a keystone term', () => {
    const offenders = ptValues.filter((v) => KEYSTONE_TERM_RE.test(v));
    expect(offenders, `keystone-shaped PT values survived: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
