/**
 * Every user-facing string is well-formed text, in both languages.
 *
 * Written after a Portuguese banner title shipped as "O save importado estÃ¡ sem dados da conta"
 * — a UTF-8 `á` whose bytes were re-encoded as if they were Latin-1, so the accented character
 * became two. The whole suite stayed green: `i18n-split-parity` compares KEY SETS, the copy
 * contract greps for over-claiming phrases, and neither reads a string's characters. A garbled
 * headline is invisible to every check the repo had, and only a Portuguese reader would ever see
 * it, which is precisely the class of defect that survives review.
 */
import { describe, expect, it } from 'vitest';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: Lang[] = ['en', 'pt'];

/**
 * The signature of Latin-1-re-encoded UTF-8: a leading byte from the C0/C1 range (`Ã`, `Â`, `â`)
 * immediately followed by what was a UTF-8 continuation byte (`U+0080`–`U+00BF`). Real prose in
 * either language never puts a C1 control or a lone inverted-punctuation mark straight after an
 * accented capital, so this does not fire on legitimate `ã`/`â`/`ç`.
 */
const DOUBLE_ENCODED = /[\u00C0-\u00DF\u00E2][\u0080-\u00BF]/;

/** A lossy decode anywhere upstream leaves this behind. Never legitimate in copy. */
const REPLACEMENT_CHAR = '\uFFFD';

function walk(value: unknown, path: string, visit: (text: string, path: string) => void): void {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}.${index}`, visit));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) walk(entry, `${path}.${key}`, visit);
  }
}

describe('i18n strings are well-formed text', () => {
  for (const lang of LANGS) {
    it(`${lang}: no string carries Latin-1-re-encoded UTF-8`, () => {
      const offenders: string[] = [];
      walk(STRINGS[lang], lang, (text, path) => {
        if (DOUBLE_ENCODED.test(text)) offenders.push(`${path}: "${text}"`);
      });
      expect(offenders).toEqual([]);
    });

    it(`${lang}: no string carries a replacement character`, () => {
      const offenders: string[] = [];
      walk(STRINGS[lang], lang, (text, path) => {
        if (text.includes(REPLACEMENT_CHAR)) offenders.push(`${path}: "${text}"`);
      });
      expect(offenders).toEqual([]);
    });
  }

  it('red state demonstrated: the exact defect this was written for is caught', () => {
    expect(DOUBLE_ENCODED.test('O save importado est\u00c3\u00a1 sem dados da conta')).toBe(true);
    expect(DOUBLE_ENCODED.test('errado \u00e2\u0080\u0094 inclusive fases')).toBe(true);
  });

  it('does not fire on legitimate Portuguese accents or an em dash', () => {
    expect(DOUBLE_ENCODED.test('O save importado est\u00e1 sem dados da conta')).toBe(false);
    expect(DOUBLE_ENCODED.test('N\u00edvel da casa \u2014 pr\u00f3xima Casa, n\u00e3o \u00e9 op\u00e7\u00e3o')).toBe(false);
    expect(DOUBLE_ENCODED.test(STRINGS.pt.accountMissingFieldsTitle)).toBe(false);
  });
});
