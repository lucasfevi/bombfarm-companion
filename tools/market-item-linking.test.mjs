/**
 * The seam the type system cannot reach: that the snapshot builder actually SUPPLIES the gem list
 * the name generator needs, built from the real committed game data. The builder is `.mjs` and is
 * not typechecked, so a required field on `CatalogView` proves nothing about it.
 *
 * This drives the builder's own `loadCatalog()` and the built `reconcile`, over synthetic market
 * rows and no network. A builder that stops loading the bundle, or a generated name that drifts
 * from the one the market carries, fails here.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertWorkspaceDistBuilt } from './require-workspace-dist.mjs';

// Per-file build guard, on this file's OWN key: it resolves @bombfarm/pricing through that
// package's exports map, which points at ./dist/**. Both imports below are dynamic so this assert
// runs first and names the unbuilt package, instead of the import dying at collection with an
// error that points nowhere near `pnpm build`. The package specifier goes through a variable
// because Vite's import analysis resolves a LITERAL one while transforming this file — before any
// top-level code runs — and hands back its own opaque message instead.
assertWorkspaceDistBuilt('tools/market-item-linking.test.mjs');

const PRICING_PACKAGE = '@bombfarm/pricing';
const { priceKey, reconcile } = await import(/* @vite-ignore */ PRICING_PACKAGE);
const { loadCatalog } = await import('./market-snapshot/build.mjs');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const wiki = JSON.parse(readFileSync(join(root, 'packages/domain/src/data/phase-wiki.json'), 'utf-8'));

const catalog = loadCatalog();
const FETCHED = '2026-08-31T00:00:00.000Z';

const row = (hashName) => ({
  hashName,
  name: hashName,
  sellPriceCents: 100,
  listings: 1,
  iconUrl: null,
  type: null,
});

const reconcileOne = (hashName) => {
  const { entries, anomalies } = reconcile([row(hashName)], catalog, FETCHED);
  return { entry: entries[0], anomalies };
};

const ACT_CHEST_FAMILIES = [
  ['Hero Cage', 'chest_hero'],
  ['Time Chest', 'chest_time'],
  ['Gem Chest', 'chest_gem'],
  ['Skill Stone Chest', 'chest_skill'],
];
const ACTS = [1, 2, 3];

describe('the builder supplies every identity the catalog cannot', () => {
  it('non-vacuity: the bundle carries gems and the builder loaded them', () => {
    expect(wiki.gems.list.length).toBeGreaterThan(0);
    expect(catalog.gems).toHaveLength(wiki.gems.list.length);
  });

  /**
   * The rarity is the half a name cannot carry. `Emerald Gem` says nothing about being Raro, so a
   * builder that loaded the names without the rarities would key every gem at no rarity at all.
   */
  it('links every gem the bundle names to its own def, at the rarity the bundle fixes', () => {
    const linked = wiki.gems.list.map((gem) => {
      const { entry, anomalies } = reconcileOne(`${gem.name} Gem`);

      expect(entry?.defId, gem.defId).toBe(gem.defId);
      expect(entry?.rarityIdx, gem.defId).toBe(gem.rarity);
      expect(entry?.key, gem.defId).toBe(priceKey(gem.defId, gem.rarity));
      expect(anomalies, gem.defId).toEqual([]);
      return entry.hashName;
    });

    expect(new Set(linked).size).toBe(wiki.gems.list.length);
  });

  it('links every act chest family across the acts the market carries, to distinct defs', () => {
    const defIds = [];
    for (const [family, defPrefix] of ACT_CHEST_FAMILIES) {
      for (const act of ACTS) {
        const hashName = `${family} (Act ${String(act)})`;
        const { entry, anomalies } = reconcileOne(hashName);

        expect(entry?.defId, hashName).toBe(`${defPrefix}_${String(act)}`);
        expect(anomalies, hashName).toEqual([]);
        defIds.push(entry.defId);
      }
    }

    expect(new Set(defIds).size).toBe(ACT_CHEST_FAMILIES.length * ACTS.length);
  });

  it('links a real equipment row through the set and slot words the market spells', () => {
    const { entry, anomalies } = reconcileOne('Glacier Chestplate Lv 60 (Legendary)');

    expect(entry?.defId).toBe('glacier_peito');
    expect(entry?.key).toBe(priceKey('glacier_peito', 4));
    expect(anomalies).toEqual([]);
  });

  it.each([
    ['Obsidian Gem', 'unknown#'],
    ['Rune Chest (Act 1)', 'unknown#'],
  ])('reports %s rather than borrowing a named item price', (hashName, keyPrefix) => {
    const { entry, anomalies } = reconcileOne(hashName);

    expect(entry?.defId).toBeNull();
    expect(entry?.key).toBe(`${keyPrefix}${hashName}`);
    expect(anomalies.map((anomaly) => anomaly.kind)).toEqual(['unlinkable-item']);
    expect(anomalies[0]?.detail).toContain(hashName);
  });
});
