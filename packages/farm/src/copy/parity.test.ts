/**
 * Three proofs that `en.ts` and `pt-BR.ts` never diverge in key set or placeholder set.
 * Proof 1 (compile) is the `FarmCopy` annotation itself (`export const farmPtBR: FarmCopy = { … }`
 * in `pt-BR.ts`) — a missing key is `TS2741`, a typo'd extra key `TS2353`. Proofs 2 and 3 below are
 * independent, permanent, runtime checks: they survive a future refactor that widens `FarmCopy` to
 * an index signature, which would silently disable proof 1 without touching either of these.
 */
import { describe, expect, it } from 'vitest';
import { farmEn } from './en';
import { farmPtBR } from './pt-BR';

/**
 * Legitimately identical pairs between `farmEn` and `farmPtBR` (a declared table, not an inferred
 * one). Kept deliberately short and reviewed: a future addition here is a reviewed diff, never a
 * silent weakening of the "no leakage" assertion below.
 *
 * `phaseHelp` ('wiki') / `cycleWiki` ('Wiki'): names the wiki itself, a proper noun in both.
 * `colHp` ('HP') / `farmRankingColXp` ('XP') / `mitPct` ('Mit %'): the game's own abbreviations,
 * spelled the same either way — 'Mitigação' abbreviates to 'Mit' exactly as 'Mitigation' does.
 * `colHits` ('Hits'): the loanword the pt-BR copy already uses for a hit elsewhere in this table.
 * `phasesColNormalHit` ('Normal'): a real Portuguese word with the identical spelling — the
 * full-length `phasesNormalHit` next to it IS translated ('Hit normal').
 * `farmRankingReturnBonusVip` ('VIP') / `phasesJaulaWindowVip` ('VIP {dur}'): 'VIP' is the same
 * initialism in both, and `{dur}` arrives already localised.
 */
const IDENTICAL_IN_BOTH_LANGUAGES: readonly (keyof typeof farmEn)[] = [
  'phaseHelp',
  'cycleWiki',
  'colHp',
  'colHits',
  'mitPct',
  'farmRankingColXp',
  'phasesColNormalHit',
  'farmRankingReturnBonusVip',
  'phasesJaulaWindowVip',
];

function placeholderSet(value: string): Set<string> {
  const matches = value.matchAll(/\{(\w+)\}/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

describe('farmEn/farmPtBR key-set parity', () => {
  it('both languages declare the exact same set of keys', () => {
    expect(Object.keys(farmEn).sort()).toEqual(Object.keys(farmPtBR).sort());
  });

  it('red state demonstrated: removing a key from one side is caught by the same comparison the real test uses', () => {
    const withoutOneKey: Record<string, string> = { ...farmEn };
    delete withoutOneKey.farmRankingTitle;
    expect(Object.keys(withoutOneKey).sort()).not.toEqual(Object.keys(farmPtBR).sort());
  });
});

describe('farmEn/farmPtBR placeholder parity', () => {
  // sub() leaves an unmatched {token} substituted with the empty string, so a per-key placeholder
  // mismatch silently DELETES a number from the rendered sentence rather than showing a broken
  // token. No type can catch that.
  it('every key has the identical set of {placeholder} tokens in both languages', () => {
    const mismatches: { key: string; en: string[]; ptBR: string[] }[] = [];
    for (const key of Object.keys(farmEn) as (keyof typeof farmEn)[]) {
      const enTokens = placeholderSet(farmEn[key]);
      const ptTokens = placeholderSet(farmPtBR[key]);
      const same =
        enTokens.size === ptTokens.size && [...enTokens].every((token) => ptTokens.has(token));
      if (!same) {
        mismatches.push({ key, en: [...enTokens].sort(), ptBR: [...ptTokens].sort() });
      }
    }
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('red state demonstrated: renaming one placeholder in one language is caught', () => {
    const mutated = farmPtBR.phasesPhaseId.replace('{id}', '{fase}');
    expect([...placeholderSet(farmEn.phasesPhaseId)]).not.toEqual([...placeholderSet(mutated)]);
  });
});

describe('no PT leakage in EN, no EN leakage in PT', () => {
  it('every key differs between the two languages, except the declared identical-pair allowlist', () => {
    const unexpectedlyIdentical: string[] = [];
    for (const key of Object.keys(farmEn) as (keyof typeof farmEn)[]) {
      if (IDENTICAL_IN_BOTH_LANGUAGES.includes(key)) continue;
      if (farmEn[key] === farmPtBR[key]) unexpectedlyIdentical.push(key);
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
      expect(farmEn[key], key).toBe(farmPtBR[key]);
    }
  });
});
