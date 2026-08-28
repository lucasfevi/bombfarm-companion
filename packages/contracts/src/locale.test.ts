import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './index.js';
import {
  APP_LOCALES,
  BCP47_BY_LOCALE,
  DOMAIN_LANG_BY_LOCALE,
  isAppLocale,
  resolveStartupLocale,
  toDomainLang,
} from './locale.js';

describe('APP_LOCALES / the two mapping tables', () => {
  it('APP_LOCALES is exactly the closed AppLocale union', () => {
    expect(APP_LOCALES).toEqual(['en', 'pt-BR']);
  });

  it('DOMAIN_LANG_BY_LOCALE is total over AppLocale', () => {
    for (const locale of APP_LOCALES) {
      expect(DOMAIN_LANG_BY_LOCALE[locale]).toBeDefined();
    }
    expect(DOMAIN_LANG_BY_LOCALE).toEqual({ en: 'en', 'pt-BR': 'pt' });
  });

  it('BCP47_BY_LOCALE is total over AppLocale', () => {
    for (const locale of APP_LOCALES) {
      expect(BCP47_BY_LOCALE[locale]).toBeDefined();
    }
    expect(BCP47_BY_LOCALE).toEqual({ en: 'en-US', 'pt-BR': 'pt-BR' });
  });

  it('toDomainLang is the one mapping', () => {
    expect(toDomainLang('en')).toBe('en');
    expect(toDomainLang('pt-BR')).toBe('pt');
  });
});

describe('isAppLocale', () => {
  it('accepts every real AppLocale', () => {
    expect(isAppLocale('en')).toBe(true);
    expect(isAppLocale('pt-BR')).toBe(true);
  });

  it.each([['pt'], ['PT-BR'], ['en-US'], [''], [null], [undefined], [0], [{}]])(
    'rejects %p — a malformed persisted row must not pin the app to a language nobody chose',
    (value) => {
      expect(isAppLocale(value)).toBe(false);
    },
  );
});

describe('resolveStartupLocale', () => {
  it.each([
    // Portuguese variants — every one resolves to pt-BR/system, not only exact pt-BR.
    ['pt-BR', 'pt-BR', 'system'],
    ['pt_BR', 'pt-BR', 'system'],
    ['PT-br', 'pt-BR', 'system'],
    ['pt', 'pt-BR', 'system'],
    // pt-PT: the token names the translation that exists, not the player's region — a
    // pt-PT player reads PT-BR far better than English, and it is a fully overridable default.
    ['pt-PT', 'pt-BR', 'system'],
    ['pt-AO', 'pt-BR', 'system'],
    // English variants.
    ['en', 'en', 'system'],
    ['en-US', 'en', 'system'],
    ['en-GB', 'en', 'system'],
    ['EN', 'en', 'system'],
    // Neither — the default, never a throw, never a raw key.
    ['es-AR', 'en', 'default'],
    ['fr', 'en', 'default'],
    ['zh-Hans-CN', 'en', 'default'],
    ['C', 'en', 'default'],
    ['zz', 'en', 'default'],
    ['', 'en', 'default'],
    [undefined, 'en', 'default'],
  ] as const)(
    'systemLocale=%p, no stored override => { locale: %p, source: %p }',
    (systemLocale, expectedLocale, expectedSource) => {
      const result = resolveStartupLocale({ stored: null, systemLocale });
      // Both locale AND source are asserted on every row: { locale: 'en', source: 'system' } and
      // { locale: 'en', source: 'default' } have identical `locale` output, so asserting locale
      // alone would let the two branches be silently merged — exactly the distinction between
      // the system-resolved locale and the safe-default fallback that this table exists to protect.
      expect(result.locale).toBe(expectedLocale);
      expect(result.source).toBe(expectedSource);
    },
  );

  it("stored 'en' beats a conflicting pt-BR system locale — source: 'stored', the OS is not consulted", () => {
    const result = resolveStartupLocale({ stored: 'en', systemLocale: 'pt-BR' });
    expect(result).toEqual({ locale: 'en', source: 'stored' });
  });

  it("stored 'pt-BR' beats a conflicting en-US system locale — source: 'stored'", () => {
    const result = resolveStartupLocale({ stored: 'pt-BR', systemLocale: 'en-US' });
    expect(result).toEqual({ locale: 'pt-BR', source: 'stored' });
  });

  it('a null stored value falls through to system detection', () => {
    const result = resolveStartupLocale({ stored: null, systemLocale: 'pt-BR' });
    expect(result).toEqual({ locale: 'pt-BR', source: 'system' });
  });

  it('never throws on an unparseable systemLocale', () => {
    expect(() => resolveStartupLocale({ stored: null, systemLocale: undefined })).not.toThrow();
  });

  it("the default branch's locale is DEFAULT_SETTINGS.locale, not a hardcoded 'en'", () => {
    const result = resolveStartupLocale({ stored: null, systemLocale: 'zz' });
    expect(result.locale).toBe(DEFAULT_SETTINGS.locale);
  });
});
