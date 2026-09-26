/**
 * The Steam market spells this app's slots and rarities in English; the committed catalog names
 * them in the game's own codes. `packages/pricing/src/market/names.ts` is the only bridge, and a gap
 * in it does not fail loudly — a slot with no word generates no name, so every item in it quietly
 * loses its price.
 *
 * This reads the tables out of the source text rather than importing the built package, so the
 * guard stays build-free and can run in a cheap job. Every predicate is asserted twice: true
 * against the real files, and false against a mutation of the same text.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const NAMES_PATH = join(root, 'packages/pricing/src/market/names.ts');
const TAGS_PATH = join(root, 'packages/pricing/src/market/tags.ts');
const CATALOG_PATH = join(root, 'packages/domain/src/data/catalog.json');
const WIKI_PATH = join(root, 'packages/domain/src/data/phase-wiki.json');

const namesSource = readFileSync(NAMES_PATH, 'utf-8');
const tagsSource = readFileSync(TAGS_PATH, 'utf-8');
const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
const wiki = JSON.parse(readFileSync(WIKI_PATH, 'utf-8'));

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
  catalogSlots.every((slot) =>
    tableEntries(source, 'MARKET_SLOT_WORD').some(([code]) => code === slot),
  );

const rarityIdxsCovered = (source) =>
  catalogRarityIdxs.every((idx) =>
    tableEntries(source, 'MARKET_RARITY_WORD').some(([key]) => Number(key) === idx),
  );

const slotTableIsOneToOne = (source) => {
  const words = tableEntries(source, 'MARKET_SLOT_WORD').map(([, word]) => word);
  return new Set(words).size === words.length;
};

/**
 * The catalog holds no gems and no chests, so the predicates above could never have covered the
 * two market categories whose identity the catalog cannot supply. These three do, from the game
 * data that actually names them.
 */
const gemsAreDerivedNotTabled = (source) => tableBody(source, 'GEM_DEF_BY_HASH') == null;

const everyGemHasAnIdentity = (gems) =>
  gems.length === 9 &&
  gems.every(
    (gem) =>
      typeof gem.defId === 'string' &&
      typeof gem.name === 'string' &&
      typeof gem.rarity === 'number',
  );

const chestTableIsKeyedByFamily = (source) =>
  tableEntries(source, 'ACT_CHEST_FAMILY_DEF').length === 4 &&
  tableEntries(source, 'ACT_CHEST_FAMILY_DEF').every(([, def]) => def.startsWith('chest_')) &&
  !/\(Act \d/.test(tableBody(source, 'ACT_CHEST_FAMILY_DEF') ?? '');

describe('the market name words against the committed catalog', () => {
  it('finds real tables to read, so the predicates below are not vacuous', () => {
    expect(tableEntries(namesSource, 'MARKET_SLOT_WORD').length).toBeGreaterThan(0);
    expect(tableEntries(namesSource, 'MARKET_RARITY_WORD').length).toBeGreaterThan(0);
    expect(tableEntries(tagsSource, 'ACT_CHEST_FAMILY_DEF').length).toBe(4);
    expect(catalogSlots.length).toBe(8);
    expect(catalogRarityIdxs).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('spells every catalog slot, or items in the missing slot silently lose their price', () => {
    expect(slotCodesCovered(namesSource)).toBe(true);
    expect(slotCodesCovered(namesSource.replace(/^\s*arma: 'Weapon',$/m, ''))).toBe(false);
  });

  it('spells every catalog rarity', () => {
    expect(rarityIdxsCovered(namesSource)).toBe(true);
    expect(rarityIdxsCovered(namesSource.replace(/^\s*5: 'Mythic',$/m, ''))).toBe(false);
  });

  it('never spells two catalog slots with the same word', () => {
    expect(slotTableIsOneToOne(namesSource)).toBe(true);
    expect(
      slotTableIsOneToOne(namesSource.replace(/^\s*elmo: 'Helmet',$/m, "  elmo: 'Weapon',")),
    ).toBe(false);
  });

  it('needs no table for sets, because the market spells the catalog set codes verbatim', () => {
    expect(catalog.sets).toContain('ember');
    expect(tableBody(namesSource, 'MARKET_SET_WORD')).toBeNull();
  });
});

describe('the market categories the catalog cannot speak for', () => {
  it('names no gems here, because a partial list is what left six of nine unpriceable', () => {
    expect(gemsAreDerivedNotTabled(namesSource)).toBe(true);
    expect(gemsAreDerivedNotTabled(tagsSource)).toBe(true);
    expect(
      gemsAreDerivedNotTabled(
        `${namesSource}\nexport const GEM_DEF_BY_HASH = {\n  'Emerald Gem': 'gem_emerald',\n};\n`,
      ),
    ).toBe(false);
  });

  /**
   * The rarity matters as much as the def id now: a gem's market name carries no rarity at all, so
   * the bundle is the only thing that can say `Emerald Gem` keys at rarity 2.
   */
  it('finds a def id, a name and a rarity for every gem in the game data the builder reads', () => {
    expect(everyGemHasAnIdentity(wiki.gems.list)).toBe(true);
    expect(everyGemHasAnIdentity(wiki.gems.list.slice(1))).toBe(false);
    expect(everyGemHasAnIdentity(wiki.gems.list.map((gem) => ({ ...gem, defId: undefined })))).toBe(
      false,
    );
    expect(everyGemHasAnIdentity(wiki.gems.list.map((gem) => ({ ...gem, rarity: undefined })))).toBe(
      false,
    );
  });

  it('keys the act chests by family alone, so a new act needs no entry', () => {
    const withoutGemChest = tagsSource.replace(/^\s*'Gem Chest': 'chest_gem',$/m, '');
    const gemChestDefReversed = tagsSource.replace(
      /^\s*'Gem Chest': 'chest_gem',$/m,
      "  'Gem Chest': 'gem_chest',",
    );
    const gemChestKeyedByAct = tagsSource.replace(
      /^\s*'Gem Chest': 'chest_gem',$/m,
      "  'Gem Chest (Act 1)': 'chest_gem',",
    );

    expect(chestTableIsKeyedByFamily(tagsSource)).toBe(true);
    expect(chestTableIsKeyedByFamily(withoutGemChest)).toBe(false);
    expect(chestTableIsKeyedByFamily(gemChestDefReversed)).toBe(false);
    expect(chestTableIsKeyedByFamily(gemChestKeyedByAct)).toBe(false);
  });
});
