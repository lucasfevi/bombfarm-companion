/**
 * Issue #141 — the three states of `missingRequiredFields`, and why `null` and `[]` are not
 * interchangeable.
 *
 * - `null`  — no import has been checked against the required-field rule: a fresh browser, or an
 *             account stored before the rule existed. Must stay silent, and must not change the
 *             persisted bytes of such a record (no migration was intended).
 * - `[]`    — imported and complete.
 * - a list  — imported from a save that omitted these; the banner names them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { normalizeAccount, type AccountShared } from '@/shared/lib/storage';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

const importedAccount: AccountImportData = {
  tree: null,
  houseIdx: null,
  houseLevel: null,
  phase: null,
  maxPhase: null,
};

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('normalizeAccount reads the three states apart', () => {
  it('leaves the key OFF a record that never carried it, rather than writing null', () => {
    const normalized = normalizeAccount({});

    expect('missingRequiredFields' in normalized).toBe(false);
    expect(JSON.stringify(normalized)).not.toContain('missingRequiredFields');
  });

  it('keeps an empty list — "checked and complete" is not the same as "never checked"', () => {
    expect(normalizeAccount({ missingRequiredFields: [] }).missingRequiredFields).toEqual([]);
  });

  it('keeps a real list and drops entries that are not required fields', () => {
    const raw = { missingRequiredFields: ['maxPhase', 'accountId'] } as unknown as Partial<AccountShared>;

    expect(normalizeAccount(raw).missingRequiredFields).toEqual(['maxPhase']);
  });
});

describe('the account slice records what the import found', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('starts at null — nothing has been imported yet', () => {
    expect(usePlannerStore.getState().missingRequiredFields).toBeNull();
  });

  it('applyAccountImport records the fields the save omitted', () => {
    usePlannerStore.getState().applyAccountImport(importedAccount, ['maxPhase']);

    expect(usePlannerStore.getState().missingRequiredFields).toEqual(['maxPhase']);
  });

  it('applyAccountImport leaves [] — not null — when the caller reports nothing missing', () => {
    usePlannerStore.getState().applyAccountImport(importedAccount, ['maxPhase']);
    usePlannerStore.getState().applyAccountImport(importedAccount);

    // An import happened, so "never checked" is over even when the caller supplies no verdict.
    expect(usePlannerStore.getState().missingRequiredFields).toEqual([]);
  });

  it('a re-import from a healthy save clears a previous save\u2019s findings', () => {
    usePlannerStore.getState().applyAccountImport(importedAccount, ['houseIdx', 'maxPhase']);
    usePlannerStore.getState().applyAccountImport(importedAccount, []);

    expect(usePlannerStore.getState().missingRequiredFields).toEqual([]);
  });

  it('hydrateAccount reads a pre-rule stored record back as null', () => {
    usePlannerStore.getState().hydrateAccount(normalizeAccount({}));

    expect(usePlannerStore.getState().missingRequiredFields).toBeNull();
  });

  it('survives a store round-trip through the persisted shape', () => {
    usePlannerStore.getState().applyAccountImport(importedAccount, ['phase', 'maxPhase']);
    const shared = selectAccountShared(usePlannerStore.getState());

    resetPlannerStoreForTests();
    const persisted = JSON.parse(JSON.stringify(shared)) as Partial<AccountShared>;
    usePlannerStore.getState().hydrateAccount(normalizeAccount(persisted));

    expect(usePlannerStore.getState().missingRequiredFields).toEqual(['phase', 'maxPhase']);
  });

  it('selectAccountShared omits the key entirely while nothing has been imported', () => {
    const shared = selectAccountShared(usePlannerStore.getState());

    expect(JSON.stringify(shared)).not.toContain('missingRequiredFields');
  });
});
