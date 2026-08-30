/**
 * Three proofs that `en.ts` and `pt-BR.ts` never diverge in key set or placeholder set.
 * Proof 1 (compile) is the `Copy` annotation itself
 * (`export const ptBR: Copy = { … }` in `pt-BR.ts`) — it is demonstrated, not asserted here, by
 * temporarily deleting/mistyping a key and recording the `TS2741`/`TS2353` message verbatim,
 * then restoring. Proofs 2 and 3 below are independent, permanent, runtime checks:
 * they survive a future refactor that widens `Copy` to an index signature, which would silently
 * disable proof 1 without touching either of these.
 */
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ptBR } from './pt-BR';

/**
 * Legitimately identical pairs between `en` and `ptBR` (a declared table, not an inferred one). Kept
 * deliberately short and reviewed: a future addition here is a reviewed diff, never a silent
 * weakening of the "no leakage" assertion below.
 *
 * `ageShortSeconds` ('{n}s'): 's' abbreviates seconds identically in English and Portuguese —
 * unlike minutes ('m' vs 'min'), there is no PT-BR-specific abbreviation to translate to.
 */
// inventoryDetailSetSlot: pure layout, no words — two placeholders joined by a separator, and
// both of the values it joins are themselves already localised before they reach it.
// liveEarningsXpHeadlineUnit: "xp / h" — "xp" is the same abbreviation in both languages, and the
// "/ h" unit marker is not a word either, so the two languages land on the identical string.
// inventoryViewLabel: "Layout" is a loanword carrying the same spelling in pt-BR, and it names
// the cards/list switch rather than either option — both of which ARE translated.
// liveMapXpPerPropLabel: "XP / prop" — "XP" is the same abbreviation in both languages, and
// "prop" is the loanword the game itself uses in Portuguese (the pt-BR copy already spells it
// "props" elsewhere in this table), so the two languages land on the identical string.
const IDENTICAL_IN_BOTH_LANGUAGES: readonly (keyof typeof en)[] = [
  'ageShortSeconds',
  'liveMapXpPerPropLabel',
  'inventoryDetailSetSlot',
  'liveEarningsXpHeadlineUnit',
  'inventoryViewLabel',
];

function placeholderSet(value: string): Set<string> {
  const matches = value.matchAll(/\{(\w+)\}/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

describe('en/ptBR key-set parity', () => {
  it('en and ptBR declare the exact same set of keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
  });

  it('red state demonstrated: removing a key from one side is caught by the same comparison the real test uses', () => {
    const withoutOneKey: Record<string, string> = { ...en };
    delete withoutOneKey.shellStatusConnected;
    expect(Object.keys(withoutOneKey).sort()).not.toEqual(Object.keys(ptBR).sort());
  });
});

describe('en/ptBR placeholder parity', () => {
  // sub() (copy/index.ts) leaves an unmatched {token} visibly unreplaced in the UI, and
  // docs/naming.md makes placeholder keys a data contract —
  // so a per-key placeholder-set mismatch is a defect no type can catch.
  it('every key has the identical set of {placeholder} tokens in both languages', () => {
    const mismatches: { key: string; en: string[]; ptBR: string[] }[] = [];
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const enTokens = placeholderSet(en[key]);
      const ptTokens = placeholderSet(ptBR[key]);
      const same = enTokens.size === ptTokens.size && [...enTokens].every((token) => ptTokens.has(token));
      if (!same) {
        mismatches.push({ key, en: [...enTokens].sort(), ptBR: [...ptTokens].sort() });
      }
    }
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('red state demonstrated: renaming one placeholder in one language is caught', () => {
    const mutatedPtBR = { ...ptBR, ageMinutes: ptBR.ageMinutes.replace('{n}', '{q}') };
    const enTokens = placeholderSet(en.ageMinutes);
    const ptTokens = placeholderSet(mutatedPtBR.ageMinutes);
    expect([...enTokens]).not.toEqual([...ptTokens]);
  });
});

describe('no PT leakage in EN, no EN leakage in PT', () => {
  it('every key differs between en and ptBR, except the declared identical-pair allowlist', () => {
    const unexpectedlyIdentical: string[] = [];
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (IDENTICAL_IN_BOTH_LANGUAGES.includes(key)) continue;
      if (en[key] === ptBR[key]) unexpectedlyIdentical.push(key);
    }
    expect(
      unexpectedlyIdentical,
      `These keys render identically in both languages and are NOT on the declared allowlist: ` +
        `${unexpectedlyIdentical.join(', ')}. Either translate them or add them to ` +
        `IDENTICAL_IN_BOTH_LANGUAGES with a one-line reason.`,
    ).toEqual([]);
  });

  it('the declared allowlist entries really are identical (the table is not stale)', () => {
    for (const key of IDENTICAL_IN_BOTH_LANGUAGES) {
      expect(en[key]).toBe(ptBR[key]);
    }
  });
});
