import { describe, expect, it } from 'vitest';
import { shareCardEn } from './share-card-en';
import { shareCardPtBR } from './share-card-pt-BR';

/**
 * Identical in both languages on purpose: the product name, the separator, and templates that
 * carry no words — a count beside the domain's own rarity label, a level over its cap, a DPS
 * figure, and the site address.
 */
const IDENTICAL_IN_BOTH_LANGUAGES: readonly string[] = [
  'brand',
  'separator',
  'tierCount',
  'dps',
  'auraLevel',
  'footerLink',
];

function flatten(dictionary: object): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value === 'string') flat[key] = value;
    else (value as string[]).forEach((text, index) => (flat[`${key}.${String(index)}`] = text));
  }
  return flat;
}

const EN = flatten(shareCardEn);
const PT = flatten(shareCardPtBR);

function placeholders(value: string | undefined): string[] {
  return Array.from((value ?? '').matchAll(/\{(\w+)\}/g), (match) => match[1] ?? '').sort();
}

describe('share card copy', () => {
  it('declares the same members in both languages, the medal lists included', () => {
    expect(Object.keys(PT).sort()).toEqual(Object.keys(EN).sort());
    expect(EN['medalPower.0']).toBe('Strongest');
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
