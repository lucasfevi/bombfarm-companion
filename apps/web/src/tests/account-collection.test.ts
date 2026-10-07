import { beforeEach, describe, expect, it } from 'vitest';
import { shallow } from 'zustand/shallow';
import { collectionFromSave } from '@bombfarm/domain/model';
import { normalizeAccount, type AccountShared } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, selectAccountShared, selectTreeSheetTotals, usePlannerStore } from '@/shared/stores';

const COLLECTION = collectionFromSave({ colecao: { energia: 13.03, critc: 4.8, critd: 0.22, recarga: 0.71, ouro: 10.31 } });

function importTreeWithCollection(): void {
  usePlannerStore.getState().applyAccountImport(
    {
      tree: { danoTotal: 2, critChance: 0, critDmg: 0, speed: 0, energy: 0, luckFlatPct: 0, collection: COLLECTION },
      houseIdx: null,
      houseLevel: null,
      fieldSlots: null,
    } as never,
  );
}

describe('the account tree carries the Collections bonus', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  it('an import stores it, and the tree sheet hands it to the sheet math', () => {
    importTreeWithCollection();
    expect(selectTreeSheetTotals(usePlannerStore.getState()).collection).toEqual(COLLECTION);
  });

  it('the tree sheet is shallow-equal across reads, so a shallow subscription settles', () => {
    importTreeWithCollection();
    const state = usePlannerStore.getState();
    expect(shallow(selectTreeSheetTotals(state), selectTreeSheetTotals(state))).toBe(true);
  });

  it('an account without one persists no collection key at all', () => {
    expect('collection' in selectAccountShared(usePlannerStore.getState()).tree).toBe(false);
  });

  it('survives the save and the load', () => {
    importTreeWithCollection();
    const saved = JSON.parse(JSON.stringify(selectAccountShared(usePlannerStore.getState()))) as Partial<AccountShared>;
    expect(normalizeAccount(saved).tree.collection).toEqual(COLLECTION);
  });
});
