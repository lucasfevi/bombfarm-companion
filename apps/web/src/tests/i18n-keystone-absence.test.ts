import { describe, expect, it } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import { KEYSTONE_KEYS_REMOVED } from './i18n-split-parity.test';

// MSC-05, MSC-06 — the 12 deleted keys are gone from BOTH languages, and no *surviving*
// string in either language still names a keystone. Two of the three keystone display
// names (`Abisso`, `Glass Cannon`, `Tempo Dobrado`) are official in-game terms kept
// untranslated in both languages (docs/i18n.md rule 2), so an EN-only sweep would look
// complete while the PT hints and the Sim/Não status readouts survived — this suite scans
// both languages independently and neither can satisfy it alone.

const KEYSTONE_TERM_RE = /keystone|abisso|glass ?cannon|tempo ?dobrado/i;

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

describe('i18n keystone absence (MP5 F3, MSC-05/MSC-06)', () => {
  const enValues = flattenStrings(STRINGS.en);
  const ptValues = flattenStrings(STRINGS.pt);

  // Non-vacuity first: a broken/short-circuited walk must not pass by scanning nothing.
  // Floor: measured at 544 flattened string leaves per language as of MP5 F3 (both languages
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
