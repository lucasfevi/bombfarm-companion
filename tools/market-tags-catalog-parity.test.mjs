/**
 * The Steam market names this app's slots and rarities in English; the committed catalog names
 * them in the game's own codes. `packages/pricing/src/market/tags.ts` is the only bridge, and a
 * gap in it does not fail loudly — a slot with no entry silently becomes an unmatched row, so
 * every item in it quietly loses its price.
 *
 * This reads the table out of the source text rather than importing the built package, so the
 * guard stays build-free and can run in a cheap job. Every predicate is asserted twice: true
 * against the real files, and false against a mutation of the same text.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TAGS_PATH = join(root, 'packages/pricing/src/market/tags.ts');
const CATALOG_PATH = join(root, 'packages/domain/src/data/catalog.json');

const tagsSource = readFileSync(TAGS_PATH, 'utf-8');
const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));

/** The body of `export const <name> ... = { ... };`, sliced by matching braces. */
function tableBody(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start === -1) return null;
  const open = source.indexOf('{', start);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

function tableEntries(source, name) {
  const body = tableBody(source, name);
  if (body == null) return [];
  // A key is either a bare identifier or a quoted string: the act-chest table is keyed by Steam
  // hash names, which contain spaces and parentheses and so cannot be written unquoted.
  return [...body.matchAll(/^\s*('[^']+'|[A-Za-z0-9_]+)\s*:\s*([^,\n]+),/gm)].map(([, key, value]) => [
    key.replace(/^'|'$/g, ''),
    value.trim().replace(/^'|'$/g, ''),
  ]);
}

const catalogSlots = catalog.slots;
const catalogRarityIdxs = catalog.rarities.map((rarity) => rarity.idx);

const slotCodesCovered = (source) =>
  catalogSlots.every((slot) => tableEntries(source, 'STEAM_SLOT_TO_CATALOG').some(([, code]) => code === slot));

const rarityIdxsCovered = (source) =>
  catalogRarityIdxs.every((idx) =>
    tableEntries(source, 'STEAM_RARITY_TO_IDX').some(([, value]) => Number(value) === idx),
  );

const slotTableIsOneToOne = (source) => {
  const codes = tableEntries(source, 'STEAM_SLOT_TO_CATALOG').map(([, code]) => code);
  return new Set(codes).size === codes.length;
};

describe('the Steam tag tables against the committed catalog', () => {
  it('finds a real table to read, so the predicates below are not vacuous', () => {
    expect(tableEntries(tagsSource, 'STEAM_SLOT_TO_CATALOG').length).toBeGreaterThan(0);
    expect(tableEntries(tagsSource, 'STEAM_RARITY_TO_IDX').length).toBeGreaterThan(0);
    expect(tableEntries(tagsSource, 'ACT_CHEST_FAMILY_DEF').length).toBe(4);
    expect(catalogSlots.length).toBe(8);
    expect(catalogRarityIdxs).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('maps every catalog slot, or items in the missing slot silently lose their price', () => {
    expect(slotCodesCovered(tagsSource)).toBe(true);
    expect(slotCodesCovered(tagsSource.replace(/^\s*weapon: 'arma',$/m, ''))).toBe(false);
  });

  it('maps every catalog rarity', () => {
    expect(rarityIdxsCovered(tagsSource)).toBe(true);
    expect(rarityIdxsCovered(tagsSource.replace(/^\s*mythic: 5,$/m, ''))).toBe(false);
  });

  it('never points two Steam slot tags at the same catalog slot', () => {
    expect(slotTableIsOneToOne(tagsSource)).toBe(true);
    expect(
      slotTableIsOneToOne(tagsSource.replace(/^\s*helmet: 'elmo',$/m, "  helmet: 'arma',")),
    ).toBe(false);
  });

  it('needs no table for sets, because Steam publishes the catalog set codes verbatim', () => {
    expect(catalog.sets).toContain('ember');
    expect(tableBody(tagsSource, 'STEAM_SET_TO_CATALOG')).toBeNull();
  });
});
