import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CatalogView } from '../names.js';

/**
 * The catalog view the snapshot builder assembles, read from the same committed files it reads.
 *
 * Tests that drive a synthetic catalog prove the code's shape; this proves it against the data the
 * published snapshot is actually generated from, which is where a set, a slot or a gem going
 * missing would cost real prices.
 */
const CATALOG_PATH = fileURLToPath(
  new URL('../../../../domain/src/data/catalog.json', import.meta.url),
);
const WIKI_PATH = fileURLToPath(
  new URL('../../../../domain/src/data/phase-wiki.json', import.meta.url),
);

interface RawCatalog {
  defs: { id: string; set: string; slot: string; nativeLevel: number }[];
  rarities: { idx: number; label: string }[];
}

interface RawWiki {
  gems: { list: { defId: string; name: string; rarity: number }[] };
}

const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8')) as RawCatalog;
const wiki = JSON.parse(readFileSync(WIKI_PATH, 'utf-8')) as RawWiki;

export const COMMITTED_CATALOG: CatalogView = {
  defs: raw.defs.map((def) => ({
    defId: def.id,
    set: def.set,
    slot: def.slot,
    level: def.nativeLevel,
  })),
  rarityIdxs: raw.rarities.map((rarity) => rarity.idx),
  rarityTokens: Object.fromEntries(
    raw.rarities.map((rarity) => [
      rarity.idx,
      rarity.label
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase(),
    ]),
  ),
  gems: wiki.gems.list.map((gem) => ({
    defId: gem.defId,
    name: gem.name,
    rarityIdx: gem.rarity,
  })),
};
