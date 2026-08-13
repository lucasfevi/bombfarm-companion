/**
 * MPV-18: every value in `en.ts` must satisfy `docs/i18n.md`'s player-facing plain-language
 * rules — no formulas, no camelCase identifiers, no field paths, no type names. Explicitly
 * covers the section names rendering as player language ("your skill tree"), not the raw
 * `AccountSection` key (`skills`).
 *
 * MPV-07/MPV-17: `ACCOUNT_SECTION_COPY_KEY` maps every `AccountSection` to a copy key,
 * exhaustively.
 */
import { describe, expect, it } from 'vitest';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { en } from './en';
import { ACCOUNT_SECTION_COPY_KEY, type Copy } from './index';

type CopyViolation = { key: string; reason: 'camelCase identifier' | 'field path' | 'type name' | 'formula character'; value: string };

// A run of a lowercase word immediately followed by a capitalized word, no space between
// (`effectiveUpgrade`) — never a legitimate two-word English phrase, which always has a space.
const CAMEL_CASE = /\b[a-z]+[A-Z][a-zA-Z0-9]*\b/;
// `a.b` token shape — an object/field path. Prose sentences end a `.` with a space or EOL, so
// this never fires on ordinary punctuation.
const FIELD_PATH = /\b[a-zA-Z_]\w*\.[a-zA-Z_]\w*\b/;
// A capitalized word with a second internal capital and at least one lowercase letter between
// them (`HeroRecord`, `AccountShared`) — ordinary capitalized English words never do this.
const TYPE_NAME = /\b[A-Z][a-z0-9]+[A-Z]\w*\b/;
// Assignment/algebra shapes lifted straight from docs/i18n.md's own examples.
const FORMULA_CHAR = /[=+*^]|\b(?:max|min)\(/;

/** Exported so `T6`'s broader renderer guard can reuse the same rule set if it chooses to. */
export function findCopyViolations(entries: Record<string, string>): CopyViolation[] {
  const violations: CopyViolation[] = [];
  for (const [key, value] of Object.entries(entries)) {
    if (CAMEL_CASE.test(value)) {
      violations.push({ key, reason: 'camelCase identifier', value });
    } else if (FIELD_PATH.test(value)) {
      violations.push({ key, reason: 'field path', value });
    } else if (TYPE_NAME.test(value)) {
      violations.push({ key, reason: 'type name', value });
    } else if (FORMULA_CHAR.test(value)) {
      violations.push({ key, reason: 'formula character', value });
    }
  }
  return violations;
}

describe('en.ts satisfies docs/i18n.md plain-language rules (MPV-18)', () => {
  it('every real copy value is free of camelCase identifiers, field paths, type names and formula characters', () => {
    const violations = findCopyViolations(en);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("red state (demonstrated here, never left in en.ts): the scanner catches each rule on a fixture object, naming the offending key", () => {
    const badFixture = {
      goodKey: 'a perfectly normal player-facing sentence',
      badCamelCaseKey: 'The plan uses effectiveUpgrade as a floor.',
      badFieldPathKey: 'Reads from account.tree directly.',
      badTypeNameKey: 'Backed by an AccountShared record.',
      badFormulaKey: 'Scoring assumes max(item, floor).',
    };
    const violations = findCopyViolations(badFixture);
    const byKey = Object.fromEntries(violations.map((v) => [v.key, v.reason]));

    expect(byKey.badCamelCaseKey).toBe('camelCase identifier');
    expect(byKey.badFieldPathKey).toBe('field path');
    expect(byKey.badTypeNameKey).toBe('type name');
    expect(byKey.badFormulaKey).toBe('formula character');
    expect(byKey.goodKey).toBeUndefined();
  });
});

describe('ACCOUNT_SECTION_COPY_KEY covers every AccountSection exhaustively (MPV-07, MPV-17)', () => {
  it('has one entry per ACCOUNT_SECTIONS member, each pointing at a real key in en', () => {
    for (const section of ACCOUNT_SECTIONS) {
      const copyKey = ACCOUNT_SECTION_COPY_KEY[section];
      expect(copyKey, `no mapping for section "${section}"`).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(en, copyKey)).toBe(true);
    }
  });

  it('every section renders as player language, non-empty text (MPV-18)', () => {
    for (const section of ACCOUNT_SECTIONS) {
      const copyKey = ACCOUNT_SECTION_COPY_KEY[section];
      const text = en[copyKey as keyof Copy];
      expect(typeof text).toBe('string');
      expect((text as string).length).toBeGreaterThan(0);
    }
  });
});
