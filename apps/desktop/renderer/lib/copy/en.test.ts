/**
 * Every value in `en.ts` must satisfy `docs/i18n.md`'s player-facing plain-language
 * rules — no formulas, no camelCase identifiers, no field paths, no type names. Explicitly
 * covers the section names rendering as player language ("your skill tree"), not the raw
 * `AccountSection` key (`skills`).
 *
 * `ACCOUNT_SECTION_COPY_KEY` maps every `AccountSection` to a copy key,
 * exhaustively.
 *
 * design §7 rule 1: the scanner now runs over `pt-BR.ts` too, via one parameterised
 * `describe.each`. The four regexes below use Unicode property escapes and the `u` flag so
 * accented Portuguese (`não`, `ação`, `você`) does not shift a `\b`/`[a-z]` boundary and
 * false-positive — fixed here, in the rule, per the absolute instruction: never exempt a key.
 */
import { describe, expect, it } from 'vitest';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { en } from './en';
import { ptBR } from './pt-BR';
import { ACCOUNT_SECTION_COPY_KEY, type Copy } from './index';

type CopyViolation = { key: string; reason: 'camelCase identifier' | 'field path' | 'type name' | 'formula character'; value: string };

// A word boundary that is Unicode-aware, unlike ASCII `\b` (which treats every accented letter —
// `não`, `ação` — as a non-word character and can therefore report a boundary in the WRONG place
// inside accented PT-BR prose). Implemented as lookaround rather than `\b` for exactly that
// reason (design §7 rule 1).
const NOT_WORD_BEFORE = '(?<![\\p{L}0-9_])';
const NOT_WORD_AFTER = '(?![\\p{L}0-9_])';

// A run of a lowercase Unicode letter immediately followed by an uppercase Unicode letter, no
// space between (`effectiveUpgrade`) — never a legitimate two-word phrase in either language,
// which always has a space. `\p{Ll}`/`\p{Lu}` (Unicode letter categories) + the `u` flag, rather
// than ASCII `[a-z]`/`[A-Z]`, so accented PT-BR words never shift where a boundary is found. The
// leading boundary is load-bearing: without it, "AccountShared" (a TYPE_NAME, not camelCase)
// would match on its internal "tS" — this is exactly the accented-boundary hazard §7 rule 1
// warns about, demonstrated by the "AccountShared" fixture in this file's own red-state test.
const CAMEL_CASE = new RegExp(`${NOT_WORD_BEFORE}\\p{Ll}+\\p{Lu}[\\p{L}0-9]*${NOT_WORD_AFTER}`, 'u');
// `a.b` token shape — an object/field path. Prose sentences end a `.` with a space or EOL, so
// this never fires on ordinary punctuation, in either language.
const FIELD_PATH = new RegExp(`${NOT_WORD_BEFORE}[\\p{L}_]\\w*\\.[\\p{L}_]\\w*${NOT_WORD_AFTER}`, 'u');
// A capitalized word with a second internal capital and at least one lowercase letter between
// them (`HeroRecord`, `AccountShared`) — ordinary capitalized words in either language never do
// this.
const TYPE_NAME = new RegExp(`${NOT_WORD_BEFORE}\\p{Lu}[\\p{Ll}0-9]+\\p{Lu}[\\p{L}0-9]*${NOT_WORD_AFTER}`, 'u');
// Assignment/algebra shapes lifted straight from docs/i18n.md's own examples. A bare `+` is the
// hazard design §7 rule 1 names explicitly for PT-BR ("+1 Penetração" reads as a formula, not
// prose) — the rule stays language-agnostic, so no PT-BR string may use `+` as a connector either.
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

describe.each([
  ['en', en],
  ['pt-BR', ptBR],
] as const)('%s satisfies docs/i18n.md plain-language rules', (_label, copy) => {
  it('every real copy value is free of camelCase identifiers, field paths, type names and formula characters', () => {
    const violations = findCopyViolations(copy);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});

// The red-state fixture test is kept UNMODIFIED (design §10, T2 Done-when) — it demonstrates the
// scanner catches each rule shape at all, independent of which language object is passed in.
describe('the scanner catches each rule on a fixture object, naming the offending key', () => {
  it("red state (demonstrated here, never left in en.ts/pt-BR.ts): the scanner catches each rule on a fixture object, naming the offending key", () => {
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

  it('red state demonstrated on accented PT-BR prose too — the fix is the Unicode-aware regex, not a per-key exemption (design §7 rule 1)', () => {
    const badPtBrFixture = {
      goodKey: 'uma frase perfeitamente normal para o jogador, com acentuação',
      badFormulaKey: '+1 Penetração (pontos)/nível',
      badCamelCaseKey: 'usa efetivoUpgrade como piso',
    };
    const violations = findCopyViolations(badPtBrFixture);
    const byKey = Object.fromEntries(violations.map((v) => [v.key, v.reason]));

    expect(byKey.badFormulaKey).toBe('formula character');
    expect(byKey.badCamelCaseKey).toBe('camelCase identifier');
    expect(byKey.goodKey).toBeUndefined();
  });
});

describe('ACCOUNT_SECTION_COPY_KEY covers every AccountSection exhaustively', () => {
  it('has one entry per ACCOUNT_SECTIONS member, each pointing at a real key in en', () => {
    for (const section of ACCOUNT_SECTIONS) {
      const copyKey = ACCOUNT_SECTION_COPY_KEY[section];
      expect(copyKey, `no mapping for section "${section}"`).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(en, copyKey)).toBe(true);
    }
  });

  it('every section renders as player language, non-empty text', () => {
    for (const section of ACCOUNT_SECTIONS) {
      const copyKey = ACCOUNT_SECTION_COPY_KEY[section];
      const text = en[copyKey as keyof Copy];
      expect(typeof text).toBe('string');
      expect((text as string).length).toBeGreaterThan(0);
    }
  });
});
