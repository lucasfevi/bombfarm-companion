import { describe, expect, it } from 'vitest';
import * as gearPlan from '@/shared/i18n/namespaces/gear-plan';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: Lang[] = ['en', 'pt'];

const BANNED_OPTIMALITY: Record<Lang, RegExp[]> = {
  en: [/\boptimal\b/i, /\bbest possible\b/i, /\bmaximum\b/i],
  pt: [/\b[oó]tim[oa]\b/i, /\bmelhor poss[ií]vel\b/i, /\bm[aá]ximo\b/i],
};

const SANCTIONED_HEADER: Record<Lang, string> = {
  en: 'Best roster DPS found by this search',
  pt: 'Melhor DPS de roster encontrado por esta busca',
};

function allGearPlanValues(lang: Lang): string[] {
  const fromStrings = Object.entries(STRINGS[lang])
    .filter(([key]) => key.startsWith('gearPlan') || key === 'navGearPlan')
    .map(([, value]) => value);
  return fromStrings.filter((value): value is string => typeof value === 'string');
}

describe('gear-plan i18n namespace', () => {
  it('exports matching EN and PT key sets', () => {
    expect(Object.keys(gearPlan.en).sort()).toEqual(Object.keys(gearPlan.pt).sort());
  });

  it('registers every namespace key on STRINGS in both languages', () => {
    for (const key of Object.keys(gearPlan.en)) {
      expect(STRINGS.en[key as keyof typeof STRINGS.en], key).toBeTruthy();
      expect(STRINGS.pt[key as keyof typeof STRINGS.pt], key).toBeTruthy();
    }
  });

  it('uses the sanctioned results header in both languages', () => {
    expect(STRINGS.en.gearPlanResultsHeader).toBe(SANCTIONED_HEADER.en);
    expect(STRINGS.pt.gearPlanResultsHeader).toBe(SANCTIONED_HEADER.pt);
  });

  for (const lang of LANGS) {
    it(`${lang}: no banned optimality vocabulary in gear-plan strings`, () => {
      for (const text of allGearPlanValues(lang)) {
        for (const pattern of BANNED_OPTIMALITY[lang]) {
          expect(text, `"${text}" matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });
  }

  it('PT copy is not a byte-identical echo of EN for representative keys', () => {
    const keys = [
      'gearPlanPageTitle',
      'gearPlanOptimize',
      'gearPlanScopeDonate',
      'gearPlanSaturationCallout',
    ] as const;
    for (const key of keys) {
      expect(STRINGS.pt[key]).not.toBe(STRINGS.en[key]);
    }
  });

  it('includes nav label in chrome-adjacent namespace keys', () => {
    expect(STRINGS.en.navGearPlan).toBe('Gear plan');
    expect(STRINGS.pt.navGearPlan).toBe('Plano de itens');
  });
});
