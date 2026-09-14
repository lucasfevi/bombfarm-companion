import { describe, expect, it } from 'vitest';
import * as chrome from '@/shared/i18n/namespaces/chrome';
import * as home from '@/shared/i18n/namespaces/home';

const CAMEL_CASE_IDENTIFIER = /\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/;
const FIELD_PATH = /\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b/;
const FORMULA = /[=×*^]/;

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe('home copy', () => {
  it('every home key is declared in both locales with the same placeholders', () => {
    const enKeys = Object.keys(home.en).sort();
    const ptKeys = Object.keys(home.pt).sort();
    expect(ptKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(0);
    for (const key of enKeys) {
      const en = home.en[key as keyof typeof home.en];
      const pt = home.pt[key as keyof typeof home.pt];
      expect(placeholders(pt), key).toEqual(placeholders(en));
    }
  });

  it('every home key begins with home', () => {
    for (const key of Object.keys(home.en)) {
      expect(key.startsWith('home'), key).toBe(true);
    }
  });

  it('no home value carries a camelCase identifier, a field path or a formula', () => {
    for (const locale of [home.en, home.pt]) {
      for (const [key, value] of Object.entries(locale)) {
        expect(value, key).not.toMatch(CAMEL_CASE_IDENTIFIER);
        expect(value, key).not.toMatch(FIELD_PATH);
        expect(value, key).not.toMatch(FORMULA);
      }
    }
  });

  it("the optimizer card's keys carry an elapsed count and the phase placeholder, and the gain's label carries no number, in both locales", () => {
    const expected: Record<string, string[]> = {
      homeCardOptimizerRecalculating: [],
      homeCardOptimizerSearching: ['elapsed'],
      homeCardOptimizerHeadlineFarm: [],
      homeCardOptimizerHeadlineDps: [],
      homeCardOptimizerScoredAt: ['phase'],
      homeCardOptimizerSeeFullPlan: [],
    };
    expect(Object.keys(expected)).toHaveLength(6);
    for (const locale of [home.en, home.pt]) {
      for (const [key, names] of Object.entries(expected)) {
        const value = locale[key as keyof typeof home.en];
        expect(typeof value, key).toBe('string');
        expect(placeholders(value), key).toEqual(names);
      }
    }
  });

  it("the nav label for the front page exists in both locales beside the planner's", () => {
    expect(chrome.en.navHome).toBe('Home');
    expect(chrome.pt.navHome).toBe('Início');
    expect(chrome.en.navPlanner).toBe('Planner');
    expect(chrome.pt.navPlanner).toBe('Planner');
    const keys = Object.keys(chrome.en);
    expect(keys.indexOf('navPlanner')).toBe(keys.indexOf('navHome') + 1);
  });
});
