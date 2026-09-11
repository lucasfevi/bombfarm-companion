/**
 * Three proofs that `panel-en.ts` and `panel-pt-BR.ts` never diverge in member set or placeholder
 * set. Proof 1 (compile) is the `: StatPanelCopy` / `: GearPanelCopy` annotation in
 * `panel-pt-BR.ts` — a missing member is `TS2741`, a typo'd extra member `TS2353` — plus the
 * `Record<Lang, …>` maps in `index.ts`, which are what check the unannotated English side. Proofs
 * 2 and 3 below are independent, permanent, runtime checks: they survive a future refactor that
 * widens either contract to an index signature, which would silently disable proof 1 without
 * touching either of these.
 *
 * Both contracts carry nested records (`statFull`, `statShort`, `slotStatFullLabels`), so every
 * check below runs over a FLATTENED view — a member set compared only at the top level would call
 * two `statShort` records equal while one of them was missing a stat.
 */
import { describe, expect, it } from 'vitest';
import { gearPanelEn, statPanelEn } from './panel-en';
import { gearPanelPtBR, statPanelPtBR } from './panel-pt-BR';

type PanelDictionary = Record<string, string | Record<string, string>>;

function flatten(dictionary: PanelDictionary): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value === 'string') {
      flat[key] = value;
      continue;
    }
    for (const [innerKey, innerValue] of Object.entries(value)) {
      flat[`${key}.${innerKey}`] = innerValue;
    }
  }
  return flat;
}

const STAT_EN = flatten(statPanelEn);
const STAT_PT = flatten(statPanelPtBR);
const GEAR_EN = flatten(gearPanelEn);
const GEAR_PT = flatten(gearPanelPtBR);

/**
 * Legitimately identical pairs across the two languages (a declared table, not an inferred one).
 * Kept deliberately short and reviewed: a future addition here is a reviewed diff, never a silent
 * weakening of the "no leakage" assertion below.
 *
 * 'Stat', 'Clone', 'Total' and 'Farm' are loanwords carrying the same spelling in pt-BR, and
 * 'gear' is the one the Portuguese sheet tip beside them already uses. 'DPS' is an initialism.
 * 'Hit' and 'Critical Hit' are the game's own untranslated combat terms. 'Pen' and '/pt'
 * abbreviate words that abbreviate identically in both languages — the unabbreviated
 * `statFull.penetration` beside the first one IS translated. The five formulas are symbolic
 * expressions whose every token happens to be language-neutral; the seven formulas beside them
 * that do contain a translatable word are all translated.
 */
const IDENTICAL_IN_BOTH_LANGUAGES: readonly string[] = [
  'statShort.penetration',
  'colSheetDeltaGear',
  'colSheetTotal',
  'colPerPt',
  'modeDps',
  'modeFarm',
  'effectiveHit',
  'effectiveCriticalHit',
  'compareAlt',
  'compareHit',
  'bdFormulaMitF',
  'bdFormulaDmg',
  'bdFormulaCriticalHit',
  'bdFormulaCritFactor',
  'bdFormulaFuse',
];

/** Reads one member, and fails loudly rather than defaulting when it is absent — a default here
 *  would let a whole assertion pass over a member set that had silently shrunk. */
function at(dictionary: Record<string, string>, key: string): string {
  const value = dictionary[key];
  if (value === undefined) throw new Error(`no such copy member: ${key}`);
  return value;
}

function placeholderSet(value: string): Set<string> {
  const matches = value.matchAll(/\{(\w+)\}/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

function placeholderMismatches(
  en: Record<string, string>,
  ptBR: Record<string, string>,
): { key: string; en: string[]; ptBR: string[] }[] {
  const mismatches: { key: string; en: string[]; ptBR: string[] }[] = [];
  for (const key of Object.keys(en)) {
    const enTokens = placeholderSet(at(en, key));
    const ptTokens = placeholderSet(ptBR[key] ?? '');
    const same =
      enTokens.size === ptTokens.size && [...enTokens].every((token) => ptTokens.has(token));
    if (!same) mismatches.push({ key, en: [...enTokens].sort(), ptBR: [...ptTokens].sort() });
  }
  return mismatches;
}

function untranslated(en: Record<string, string>, ptBR: Record<string, string>): string[] {
  return Object.keys(en).filter(
    (key) => !IDENTICAL_IN_BOTH_LANGUAGES.includes(key) && en[key] === ptBR[key],
  );
}

const DICTIONARIES: [string, Record<string, string>, Record<string, string>][] = [
  ['statPanel', STAT_EN, STAT_PT],
  ['gearPanel', GEAR_EN, GEAR_PT],
];

describe.each(DICTIONARIES)('%s member-set parity', (_name, en, ptBR) => {
  it('both languages declare the exact same set of members, nested records included', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
  });
});

describe('the flattened view really reaches inside the nested records', () => {
  it('every stat of both sheet records is its own compared member', () => {
    expect(STAT_EN['statFull.critChance']).toBe('Crit Chance');
    expect(STAT_PT['statFull.critChance']).toBe('Chance de Crítico');
    expect(STAT_EN['statShort.cdr']).toBe('CDR');
    expect(GEAR_PT['slotStatFullLabels.penetracao']).toBe('Penetração');
  });

  it('red state demonstrated: a stat missing from one nested record is caught by the same comparison', () => {
    const { critChance: _dropped, ...withoutOneStat } = statPanelEn.statFull;
    const mutated = flatten({ ...statPanelEn, statFull: withoutOneStat });
    expect(Object.keys(mutated).sort()).not.toEqual(Object.keys(STAT_PT).sort());
  });
});

describe.each(DICTIONARIES)('%s placeholder parity', (_name, en, ptBR) => {
  // sub() leaves an unmatched {token} substituted with the empty string, so a per-member
  // placeholder mismatch silently DELETES a number from the rendered sentence rather than showing
  // a broken token. No type can catch that.
  it('every member has the identical set of {placeholder} tokens in both languages', () => {
    const mismatches = placeholderMismatches(en, ptBR);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });
});

describe('placeholder scanning', () => {
  it('reaches members that really carry tokens', () => {
    expect([...placeholderSet(at(STAT_EN, 'abilitiesSpent'))].sort()).toEqual(['max', 'spent']);
    expect([...placeholderSet(at(STAT_EN, 'bdNoteSplit'))].sort()).toEqual(['own', 'team']);
  });

  it('red state demonstrated: renaming one placeholder in one language is caught', () => {
    const mutated = {
      ...STAT_PT,
      abilitiesSpent: at(STAT_PT, 'abilitiesSpent').replace('{max}', '{limite}'),
    };
    expect(placeholderMismatches(STAT_EN, mutated).map((entry) => entry.key)).toEqual([
      'abilitiesSpent',
    ]);
  });
});

describe('no PT leakage in EN, no EN leakage in PT', () => {
  it('every member differs between the two languages, except the declared allowlist', () => {
    const leaked = [...untranslated(STAT_EN, STAT_PT), ...untranslated(GEAR_EN, GEAR_PT)];
    expect(
      leaked,
      `These members render identically in both languages and are NOT on the declared allowlist: ` +
        `${leaked.join(', ')}. Either translate them or add them to IDENTICAL_IN_BOTH_LANGUAGES ` +
        `with a one-line reason.`,
    ).toEqual([]);
  });

  it('the declared allowlist entries really are identical, and none of it is stale', () => {
    const flatEn = { ...STAT_EN, ...GEAR_EN };
    const flatPt = { ...STAT_PT, ...GEAR_PT };
    for (const key of IDENTICAL_IN_BOTH_LANGUAGES) {
      expect(flatEn[key], key).toBeDefined();
      expect(flatEn[key], key).toBe(flatPt[key]);
    }
  });

  it('red state demonstrated: an untranslated member off the allowlist is caught', () => {
    const leaked = untranslated(STAT_EN, { ...STAT_PT, panelPoints: at(STAT_EN, 'panelPoints') });
    expect(leaked).toEqual(['panelPoints']);
  });
});
