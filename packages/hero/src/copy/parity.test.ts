/**
 * Three proofs that `en.ts` and `pt-BR.ts` never diverge in key set or placeholder set.
 * Proof 1 (compile) is the `HeroCopy` annotation itself (`export const heroPtBR: HeroCopy = { … }`
 * in `pt-BR.ts`) — a missing key is `TS2741`, a typo'd extra key `TS2353`. Proofs 2 and 3 below are
 * independent, permanent, runtime checks: they survive a future refactor that widens `HeroCopy` to
 * an index signature, which would silently disable proof 1 without touching either of these.
 */
import { describe, expect, it } from 'vitest';
import { heroEn } from './en';
import { heroPtBR } from './pt-BR';

/**
 * Legitimately identical pairs between `heroEn` and `heroPtBR` (a declared table, not an inferred
 * one). Kept deliberately short and reviewed: a future addition here is a reviewed diff, never a
 * silent weakening of the "no leakage" assertion below.
 *
 * `heroDetailCombatDps` ('DPS'): the community's initialism, spelled the same either way — the
 * qualified `heroDetailCombatActiveDps`/`heroDetailCombatSustainedDps` beside it ARE translated.
 * `heroDetailCombatProps` ('Props'): the loanword the pt-BR copy already uses for a map prop
 * elsewhere in this app.
 */
const IDENTICAL_IN_BOTH_LANGUAGES: readonly (keyof typeof heroEn)[] = [
  'heroDetailCombatDps',
  'heroDetailCombatProps',
];

function placeholderSet(value: string): Set<string> {
  const matches = value.matchAll(/\{(\w+)\}/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

describe('heroEn/heroPtBR key-set parity', () => {
  it('both languages declare the exact same set of keys', () => {
    expect(Object.keys(heroEn).sort()).toEqual(Object.keys(heroPtBR).sort());
  });

  it('red state demonstrated: removing a key from one side is caught by the same comparison the real test uses', () => {
    const withoutOneKey: Record<string, string> = { ...heroEn };
    delete withoutOneKey.heroDetailIdentityTitle;
    expect(Object.keys(withoutOneKey).sort()).not.toEqual(Object.keys(heroPtBR).sort());
  });
});

describe('heroEn/heroPtBR placeholder parity', () => {
  // sub() leaves an unmatched {token} substituted with the empty string, so a per-key placeholder
  // mismatch silently DELETES a number from the rendered sentence rather than showing a broken
  // token. No type can catch that.
  it('every key has the identical set of {placeholder} tokens in both languages', () => {
    const mismatches: { key: string; en: string[]; ptBR: string[] }[] = [];
    for (const key of Object.keys(heroEn) as (keyof typeof heroEn)[]) {
      const enTokens = placeholderSet(heroEn[key]);
      const ptTokens = placeholderSet(heroPtBR[key]);
      const same =
        enTokens.size === ptTokens.size && [...enTokens].every((token) => ptTokens.has(token));
      if (!same) {
        mismatches.push({ key, en: [...enTokens].sort(), ptBR: [...ptTokens].sort() });
      }
    }
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('the placeholder scan reaches keys that really carry tokens', () => {
    expect([...placeholderSet(heroEn.heroDetailRollPercentile)]).toEqual(['pct']);
    expect([...placeholderSet(heroEn.heroDetailAbilitiesSlotsValue)].sort()).toEqual([
      'max',
      'used',
    ]);
  });

  it('red state demonstrated: renaming one placeholder in one language is caught', () => {
    const mutated = heroPtBR.heroDetailRollPercentile.replace('{pct}', '{porcento}');
    expect([...placeholderSet(heroEn.heroDetailRollPercentile)]).not.toEqual([
      ...placeholderSet(mutated),
    ]);
  });
});

describe('no PT leakage in EN, no EN leakage in PT', () => {
  it('every key differs between the two languages, except the declared identical-pair allowlist', () => {
    const unexpectedlyIdentical: string[] = [];
    for (const key of Object.keys(heroEn) as (keyof typeof heroEn)[]) {
      if (IDENTICAL_IN_BOTH_LANGUAGES.includes(key)) continue;
      if (heroEn[key] === heroPtBR[key]) unexpectedlyIdentical.push(key);
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
      expect(heroEn[key], key).toBe(heroPtBR[key]);
    }
  });
});
