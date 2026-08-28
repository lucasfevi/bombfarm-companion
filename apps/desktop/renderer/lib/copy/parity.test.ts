/**
 * Three proofs that `en.ts` and `pt-BR.ts` never diverge in key set or placeholder set.
 * Proof 1 (compile) is the `Copy` annotation itself
 * (`export const ptBR: Copy = { … }` in `pt-BR.ts`) — it is demonstrated, not asserted here, by
 * temporarily deleting/mistyping a key and recording the `TS2741`/`TS2353` message verbatim
 * (task notes), then restoring. Proofs 2 and 3 below are independent, permanent, runtime checks:
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
 * unlike minutes ('m' vs 'min', design §7 rule 3), there is no PT-BR-specific abbreviation to
 * translate to.
 */
// planningRosterColumnAvatar: "Avatar" is a loanword — same spelling in pt-BR (the web planner's
// equivalent `heroAvatarCol` string is likewise "Avatar" in both its `en` and `pt` namespaces).
// inventoryDetailSetSlot: pure layout, no words — two placeholders joined by a separator, and
// both of the values it joins are themselves already localised before they reach it.
const IDENTICAL_IN_BOTH_LANGUAGES: readonly (keyof typeof en)[] = [
  'ageShortSeconds',
  'planningRosterColumnAvatar',
  'inventoryDetailSetSlot',
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
    delete withoutOneKey.shellPlanningNavLabel;
    expect(Object.keys(withoutOneKey).sort()).not.toEqual(Object.keys(ptBR).sort());
  });
});

describe('en/ptBR placeholder parity', () => {
  // sub() (copy/index.ts) leaves an unmatched {token} visibly unreplaced in the UI, and
  // docs/naming.md makes placeholder keys a data contract (renaming one is spec Out of Scope) —
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
    const mutatedPtBR = { ...ptBR, withheldBecause: ptBR.withheldBecause.replace('{sections}', '{secoes}') };
    const enTokens = placeholderSet(en.withheldBecause);
    const ptTokens = placeholderSet(mutatedPtBR.withheldBecause);
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
