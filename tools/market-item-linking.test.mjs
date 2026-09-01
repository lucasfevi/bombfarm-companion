/**
 * The seam the type system cannot reach: that the snapshot builder actually SUPPLIES the market
 * hash -> `def_id` map reconciliation needs, built from the real committed game data. The builder
 * is `.mjs` and is not typechecked, so a required field on `CatalogView` proves nothing about it.
 *
 * This drives the builder's own `loadCatalog()` and the built `reconcile`, over synthetic
 * facet-shaped rows and no network. A builder that stops loading the bundle, or an identity table
 * that drifts from it, fails here.
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
const { reconcile } = await import(/* @vite-ignore */ PRICING_PACKAGE);
const { loadCatalog } = await import('./market-snapshot/build.mjs');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const wiki = JSON.parse(readFileSync(join(root, 'packages/domain/src/data/phase-wiki.json'), 'utf-8'));

const catalog = loadCatalog();
const FETCHED = '2026-08-31T00:00:00.000Z';

const row = (hashName, tags) => ({
  row: { hashName, name: hashName, sellPriceCents: 100, listings: 1, iconUrl: null, type: null },
  tags,
});

const reconcileOne = (hashName, tags) => {
  const { entries, anomalies } = reconcile([row(hashName, tags)], catalog, FETCHED);
  return { entry: entries[0], anomalies };
};

const ACT_CHEST_FAMILIES = [
  ['Hero Cage', 'chest_hero'],
  ['Time Chest', 'chest_time'],
  ['Gem Chest', 'chest_gem'],
  ['Skill Stone Chest', 'chest_skill'],
];
const ACTS = [1, 2, 3];

describe('the builder supplies every identity reconciliation cannot derive', () => {
  it('non-vacuity: the bundle carries gems and the builder loaded them', () => {
    expect(wiki.gems.list.length).toBeGreaterThan(0);
    expect(Object.keys(catalog.defIdByHash)).toHaveLength(wiki.gems.list.length);
  });

  it('links every gem the bundle names to its own def, under distinct hashes', () => {
    const linked = wiki.gems.list.map((gem) => {
      const { entry, anomalies } = reconcileOne(`${gem.name} Gem`, {
        category: 'gem',
        rarity: 'rare',
      });
      expect(entry?.defId, gem.defId).toBe(gem.defId);
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
        const { entry, anomalies } = reconcileOne(hashName, { category: 'chest', act: String(act) });

        expect(entry?.defId, hashName).toBe(`${defPrefix}_${String(act)}`);
        expect(anomalies, hashName).toEqual([]);
        defIds.push(entry.defId);
      }
    }

    expect(new Set(defIds).size).toBe(ACT_CHEST_FAMILIES.length * ACTS.length);
  });

  it.each([
    ['Obsidian Gem', { category: 'gem', rarity: 'rare' }, 'gem#'],
    ['Rune Chest (Act 1)', { category: 'chest', act: '1' }, 'chest#'],
  ])('reports %s rather than borrowing a named item price', (hashName, tags, keyPrefix) => {
    const { entry, anomalies } = reconcileOne(hashName, tags);

    expect(entry?.defId).toBeNull();
    expect(entry?.key).toBe(`${keyPrefix}${hashName}`);
    expect(anomalies.map((anomaly) => anomaly.kind)).toEqual(['unlinkable-item']);
    expect(anomalies[0]?.detail).toContain(hashName);
  });
});
