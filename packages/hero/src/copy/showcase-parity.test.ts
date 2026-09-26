import { describe, expect, it } from 'vitest';
import { showcaseEn } from './showcase-en';
import { showcasePtBR } from './showcase-pt-BR';

/**
 * Identical in both languages on purpose: ATK, PEN and CDR are the codes players use either way,
 * the templates and separator carry no words, and the position column and badge are a bare `#`.
 */
const IDENTICAL_IN_BOTH_LANGUAGES: readonly string[] = [
  'rollStat.attack',
  'rollStat.penetration',
  'rollStat.cdr',
  'highestRollEntry',
  'highestRollsSeparator',
  'columnPosition',
  'summaryRarityEntry',
  'cardPosition',
];

function flatten(dictionary: object): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value === 'string') flat[key] = value;
    else for (const [inner, text] of Object.entries(value as Record<string, string>)) flat[`${key}.${inner}`] = text;
  }
  return flat;
}

const EN = flatten(showcaseEn);
const PT = flatten(showcasePtBR);

function placeholders(value: string | undefined): string[] {
  return Array.from((value ?? '').matchAll(/\{(\w+)\}/g), (match) => match[1] ?? '').sort();
}

describe('showcase copy', () => {
  it('declares the same members in both languages, nested stat names included', () => {
    expect(Object.keys(PT).sort()).toEqual(Object.keys(EN).sort());
    expect(EN['rollStat.critDmg']).toBe('Crit DMG');
  });

  it('carries the same placeholders in both languages', () => {
    const mismatched = Object.keys(EN).filter(
      (key) => placeholders(EN[key]).join() !== placeholders(PT[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('translates every member but the declared identical ones', () => {
    const untranslated = Object.keys(EN).filter(
      (key) => !IDENTICAL_IN_BOTH_LANGUAGES.includes(key) && EN[key] === PT[key],
    );
    expect(untranslated).toEqual([]);
  });
});
