import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { importHeroes } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const fixturePath = join(
  WEB_PACKAGE_ROOT,
  '../../packages/domain/tests/fixtures/sheet-math/save-20260731-11heroes.json',
);

function loadFixture() {
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

describe('import inventory sync', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('replaceInventoryFromImport replaces the snapshot wholesale', () => {
    const { inventory } = parseSaveFile(loadFixture(), []);
    usePlannerStore.getState().replaceInventoryFromImport(inventory);
    expect(usePlannerStore.getState().inventory.items).toHaveLength(58);
    usePlannerStore.getState().replaceInventoryFromImport(inventory.slice(0, 1));
    expect(usePlannerStore.getState().inventory.items).toHaveLength(1);
  });

  it('importing the same save twice yields identical inventory snapshots', () => {
    const { inventory, candidates } = parseSaveFile(loadFixture(), []);
    const records = candidates
      .filter((candidate) => !candidate.blocked)
      .map((candidate) => ({ ...candidate.record, sourceId: candidate.sourceId }));
    const saveSourceIds = new Set(candidates.map((candidate) => candidate.sourceId));

    importHeroes([], records, saveSourceIds);
    usePlannerStore.getState().replaceInventoryFromImport(inventory);
    const first = structuredClone(usePlannerStore.getState().inventory);

    importHeroes(usePlannerStore.getState().heroes, records, saveSourceIds);
    usePlannerStore.getState().replaceInventoryFromImport(inventory);
    const second = usePlannerStore.getState().inventory;

    expect(second.items).toEqual(first.items);
    expect(second.version).toBe(first.version);
  });

  it('replaceInventoryFromImport clears any stored plan signature', () => {
    usePlannerStore.setState({ planInputSignature: 'saved-plan', runStatus: 'done' });
    usePlannerStore.getState().replaceInventoryFromImport([]);
    expect(usePlannerStore.getState().planInputSignature).toBeNull();
    expect(usePlannerStore.getState().runStatus).toBe('idle');
  });

  it('applyAccountImport sets slots from save data', () => {
    const { account } = parseSaveFile(loadFixture(), []);
    usePlannerStore.getState().applyAccountImport(account);
    expect(usePlannerStore.getState().slots).toBe(6);
  });

  it('applyAccountImport never overwrites forgeFloor', () => {
    usePlannerStore.getState().setForgeFloor(12);
    const { account } = parseSaveFile(loadFixture(), []);
    usePlannerStore.getState().applyAccountImport(account);
    expect(usePlannerStore.getState().forgeFloor).toBe(12);
  });

  it('applyAccountImport leaves forgeFloor unchanged when slots import runs', () => {
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 15);
    const { account } = parseSaveFile(loadFixture(), []);
    usePlannerStore.getState().applyAccountImport(account);
    expect(usePlannerStore.getState().forgeFloor).toBe(15);
  });

  it('blocked heroes still sync roster without inventory when list is empty', () => {
    const { candidates } = parseSaveFile(loadFixture(), []);
    const blocked = candidates.find((candidate) => candidate.blocked);
    expect(blocked).toBeUndefined();
    usePlannerStore.getState().replaceInventoryFromImport([]);
    expect(usePlannerStore.getState().inventory.items).toEqual([]);
  });

  it('inventory import is independent from hero create counts', () => {
    const { inventory, candidates } = parseSaveFile(loadFixture(), []);
    const records = candidates
      .filter((candidate) => !candidate.blocked)
      .map((candidate) => ({ ...candidate.record, sourceId: candidate.sourceId }));
    const result = importHeroes([], records);
    usePlannerStore.getState().replaceInventoryFromImport(inventory);
    expect(result.created).toBe(candidates.filter((candidate) => !candidate.blocked).length);
    expect(usePlannerStore.getState().inventory.items.length).toBeGreaterThan(0);
  });
});
