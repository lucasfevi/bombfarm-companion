import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { importHeroes } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

// MP5 F1 (AD-068 class (a) — read from the capture): re-pointed onto
// payload-20260812-8heroes.json (27 catalogued items vs the export's 17 — the larger
// inventory keeps these sync assertions discriminating, per design.md §6.1).
const fixturePath = join(
  WEB_PACKAGE_ROOT,
  '../../packages/domain/tests/fixtures/sheet-math/payload-20260812-8heroes.json',
);

function loadFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
}

// The export-shaped subject — needed only for the real account.phase test below (the export
// carries `phase`; the default `fixturePath` payload above is the richer-inventory subject).
const exportFixturePath = join(
  WEB_PACKAGE_ROOT,
  '../../packages/domain/tests/fixtures/sheet-math/save-20260813-5heroes.json',
);

function loadFixtureJsonForExport(): Record<string, unknown> {
  return JSON.parse(readFileSync(exportFixturePath, 'utf8')) as Record<string, unknown>;
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
    expect(usePlannerStore.getState().inventory.items).toHaveLength(27);
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
    expect(usePlannerStore.getState().slots).toBe(3);
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

  // MP5 F1 (AD-068 class (a) — read from the capture): re-pointed onto the post-patch export's
  // real phase (24) — `phase-151.json` is deleted with the rest of the pre-wipe corpus
  // (AD-061; `max_phase 42` post-wipe cannot reproduce a phase-151 subject at all).
  // RECORDED LOSS: the Abisso half of the deleted assertion (`treeAbisso`/`treeAbissoBase`
  // flowing from a real save's `abisso_base`) is unreproducible — no post-patch capture
  // carries `abisso_base` at all (the 2026-08-13 patch removed the keystone). MP5 F3 later
  // removed Abisso detection itself (it had been covered by `abisso-glass-cannon.test.ts`,
  // deleted at F3's T2) — the mechanic no longer exists anywhere in the pipeline. See
  // docs/fixture-corpus.md.
  it('applyAccountImport carries a real save\'s account.phase into store phase', () => {
    const raw = loadFixtureJsonForExport();
    const { account } = parseSaveFile(raw, []);
    expect(account.phase).toBe(24);
    usePlannerStore.getState().applyAccountImport(account);
    expect(usePlannerStore.getState().phase).toBe(24);
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
