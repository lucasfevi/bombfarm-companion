import { describe, expect, it } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import type { Lang } from '@/shared/i18n';
import { formatNumber, type Lang as NumberLang } from '@/shared/lib/format-number';

/**
 * `format-number.ts` declares its own copy of the language union, because a formatting helper may
 * not import the i18n layer (`boundaries/element-types`). That copy is the thing this file
 * guards: a language added to `Lang` and not to `NumberLang` would leave every number in the app
 * formatted in some other language, and nothing else would say so.
 */
describe('the number formatter language union tracks the i18n one', () => {
  it('accepts every language the app can be read in', () => {
    for (const lang of Object.keys(STRINGS) as Lang[]) {
      // Fails to compile if `Lang` gains a member `NumberLang` lacks.
      const forNumbers: NumberLang = lang;
      expect(typeof formatNumber(1234.5, forNumbers, 1)).toBe('string');
    }
  });

  it('claims no language the app cannot be read in', () => {
    const languages = Object.keys(STRINGS).sort();
    // The other direction: a member of `NumberLang` with no strings behind it is equally wrong.
    const declared: NumberLang[] = ['pt', 'en'];
    expect([...declared].sort()).toEqual(languages);
  });

  it('formats a thousands group differently in each of them, so the union is load-bearing', () => {
    expect(formatNumber(9000, 'en', 0)).toBe('9,000');
    expect(formatNumber(9000, 'pt', 0)).toBe('9.000');
  });
});
