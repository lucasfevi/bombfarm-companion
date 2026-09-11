/**
 * Three proofs that `teamPlanEn` and `teamPlanPtBR` never diverge in key set or placeholder set.
 * Proof 1 (compile) is the `TeamPlanCopy` annotation itself (`export const teamPlanPtBR:
 * TeamPlanCopy = { … }` — `index.ts`) — a missing key is `TS2741`, a typo'd extra key `TS2353`.
 * Proofs 2 and 3 below are independent, permanent, runtime checks: they survive a future refactor
 * that widens `TeamPlanCopy` to an index signature, which would silently disable proof 1 without
 * touching either of these.
 */
import { describe, expect, it } from 'vitest';
import { teamPlanEn, teamPlanPtBR } from './index';

/**
 * Legitimately identical pairs between `teamPlanEn` and `teamPlanPtBR` (a declared table, not an
 * inferred one). Kept deliberately short and reviewed: a future addition here is a reviewed diff,
 * never a silent weakening of the "no leakage" assertion below.
 *
 * `teamPlanObjectiveOptionDamage` ('DPS'): the initialism, spelled the same in both.
 * `teamPlanColDelta` ('Δ'): the Greek letter, not a word.
 * `teamPlanTotalGainValueDps` ('{delta} dps ({pct}%)'): every word is already an abbreviation or a
 * placeholder — nothing left to translate.
 * `teamPlanHeroRowLabel` ('{name} · Lv {level} · #{id}'): three placeholders and a separator, no
 * prose.
 */
const IDENTICAL_IN_BOTH_LANGUAGES: readonly (keyof typeof teamPlanEn)[] = [
  'teamPlanObjectiveOptionDamage',
  'teamPlanColDelta',
  'teamPlanTotalGainValueDps',
  'teamPlanHeroRowLabel',
];

function placeholderSet(value: string): Set<string> {
  const matches = value.matchAll(/\{(\w+)\}/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

describe('teamPlanEn/teamPlanPtBR key-set parity', () => {
  it('both languages declare the exact same set of keys', () => {
    expect(Object.keys(teamPlanEn).sort()).toEqual(Object.keys(teamPlanPtBR).sort());
  });

  it('red state demonstrated: removing a key from one side is caught by the same comparison the real test uses', () => {
    const withoutOneKey: Record<string, string> = { ...teamPlanEn };
    delete withoutOneKey.teamPlanPageTitle;
    expect(Object.keys(withoutOneKey).sort()).not.toEqual(Object.keys(teamPlanPtBR).sort());
  });
});

describe('teamPlanEn/teamPlanPtBR placeholder parity', () => {
  // sub() leaves an unmatched {token} substituted with the empty string, so a per-key placeholder
  // mismatch silently DELETES a number from the rendered sentence rather than showing a broken
  // token. No type can catch that.
  it('every key has the identical set of {placeholder} tokens in both languages', () => {
    const mismatches: { key: string; en: string[]; ptBR: string[] }[] = [];
    for (const key of Object.keys(teamPlanEn) as (keyof typeof teamPlanEn)[]) {
      const enTokens = placeholderSet(teamPlanEn[key]);
      const ptTokens = placeholderSet(teamPlanPtBR[key]);
      const same =
        enTokens.size === ptTokens.size && [...enTokens].every((token) => ptTokens.has(token));
      if (!same) {
        mismatches.push({ key, en: [...enTokens].sort(), ptBR: [...ptTokens].sort() });
      }
    }
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('red state demonstrated: renaming one placeholder in one language is caught', () => {
    const mutated = teamPlanPtBR.teamPlanScoredPhaseChosen.replace('{phase}', '{fase}');
    expect([...placeholderSet(teamPlanEn.teamPlanScoredPhaseChosen)]).not.toEqual([
      ...placeholderSet(mutated),
    ]);
  });
});

describe('no PT leakage in EN, no EN leakage in PT', () => {
  it('every key differs between the two languages, except the declared identical-pair allowlist', () => {
    const unexpectedlyIdentical: string[] = [];
    for (const key of Object.keys(teamPlanEn) as (keyof typeof teamPlanEn)[]) {
      if (IDENTICAL_IN_BOTH_LANGUAGES.includes(key)) continue;
      if (teamPlanEn[key] === teamPlanPtBR[key]) unexpectedlyIdentical.push(key);
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
      expect(teamPlanEn[key], key).toBe(teamPlanPtBR[key]);
    }
  });
});
