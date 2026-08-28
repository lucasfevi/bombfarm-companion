/**
 * (T8) — `importRejectedUnsupportedShape`: the generic invalid-save message,
 * asserted in EN and PT-BR through `rejectionText`, and guarded against every forbidden token so
 * it stays accurate — and reusable unchanged — after the next patch.
 */
import { describe, expect, it } from 'vitest';
import type { ParseRejection } from '@bombfarm/domain/import-save';
import { rejectionText } from '@/features/import/model/compare-candidates';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: Lang[] = ['en', 'pt'];

/**
 * Case-insensitive. Covers: keystone names/vocab, keystone node ids, any 4-digit-2-digit-2-digit
 * date, a bare digit-version token, and every raw schema field path this feature's own
 * discriminator reads — none of which may leak into player-facing copy (docs/i18n.md's
 * plain-language rule).
 */
const FORBIDDEN_TOKENS = [
  'keystone',
  'abisso',
  'glass cannon',
  'tempo dobrado',
  'juro composto',
  'sorte composta',
  'D15',
  'C15',
  'V15',
  'O15',
  'S15',
  'skills.',
  'totals.',
  'refunds',
  'vagas_campo',
  'bag_tabs_bonus',
  'export_version',
] as const;

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const BARE_VERSION_PATTERN = /\bv?\d+\.\d+(\.\d+)?\b/i;

describe('importRejectedUnsupportedShape — the generic rejection copy', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: rejectionText renders importRejectedUnsupportedShape for reason "unsupportedSaveShape"`, () => {
      const rejected: ParseRejection = { reason: 'unsupportedSaveShape', heroNames: [] };
      expect(rejectionText(t, rejected)).toBe(t.importRejectedUnsupportedShape);
    });

    it(`${lang}: is a non-empty string, distinct from importRejectedNotASaveFile`, () => {
      expect(t.importRejectedUnsupportedShape.length).toBeGreaterThan(0);
      expect(t.importRejectedUnsupportedShape).not.toBe(t.importRejectedNotASaveFile);
    });

    it(`${lang}: names no forbidden token (case-insensitive)`, () => {
      const value = t.importRejectedUnsupportedShape.toLowerCase();
      const offenders = FORBIDDEN_TOKENS.filter((token) => value.includes(token.toLowerCase()));
      expect(offenders, `forbidden token(s) found: ${offenders.join(', ')}`).toEqual([]);
    });

    it(`${lang}: names no date (YYYY-MM-DD) and no bare digit-version`, () => {
      expect(DATE_PATTERN.test(t.importRejectedUnsupportedShape)).toBe(false);
      expect(BARE_VERSION_PATTERN.test(t.importRejectedUnsupportedShape)).toBe(false);
    });
  }

  it('EN and PT-BR values are each other\'s translation, not identical placeholders', () => {
    expect(STRINGS.en.importRejectedUnsupportedShape).not.toBe(STRINGS.pt.importRejectedUnsupportedShape);
  });
});
