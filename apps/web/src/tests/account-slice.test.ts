import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { normalizeAccount, type AccountShared } from '@/shared/lib/storage';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

const sampleTree = {
  danoTotal: 1.2,
  critChance: 5,
  critDmg: 10,
  speed: 3,
  energy: 4,
  teamCoinPct: 7,
  glassCannon: true,
  tempoDobrado: false,
  luckFlatPct: 6,
} as const;

describe('account slice', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('owns all 16 flat account fields with defaults', () => {
    const s = usePlannerStore.getState();
    expect(s.treeDanoTotal).toBe(1);
    expect(s.treeCritChance).toBe(0);
    expect(s.treeTeamCoinPct).toBe(0);
    expect(s.treeLuckFlatPct).toBe(0);
    expect(s.teamBuffs).toEqual(zeroTeamBuffs());
    expect(s.houseIdx).toBe(0);
    expect(s.phase).toBeNull();
    expect(s.rankMode).toBe('dps');
    expect(s.targetProp).toBe('stone');
  });

  it('AC-10: applyAccountImport writes luckFlatPct (no per-field tree setter)', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: { ...sampleTree, luckFlatPct: 5.3 },
      houseIdx: null,
      houseLevel: null,
    });
    expect(usePlannerStore.getState().treeLuckFlatPct).toBe(5.3);
  });

  it('AC-10: normalizeAccount defaults tree.luckFlatPct to 0 when the field is absent (pre-Wave-5 record)', () => {
    const preWave5Tree = {
      danoTotal: 1.2,
      critChance: 5,
      critDmg: 10,
      speed: 3,
      energy: 4,
      teamCoinPct: 7,
      glassCannon: false,
      tempoDobrado: false,
      // luckFlatPct intentionally absent — the shape every record saved before this wave has.
    };
    const normalized = normalizeAccount({
      tree: preWave5Tree,
      teamBuffs: zeroTeamBuffs(),
      context: {
        houseIdx: 0,
        houseLevel: 0,
        phase: null,
        mitigationPct: 1,
        rankMode: 'dps',
        targetProp: null,
      },
    });
    expect(normalized.tree.luckFlatPct).toBe(0);
    expect(normalized.context.targetProp).toBe('stone');
  });

  it('selectAccountShared returns a stable reference while the account tuple is unchanged', () => {
    const a = selectAccountShared(usePlannerStore.getState());
    const b = selectAccountShared(usePlannerStore.getState());
    expect(a).toBe(b);
    usePlannerStore.getState().applyAccountImport({
      tree: { ...sampleTree, danoTotal: 1.5 },
      houseIdx: null,
      houseLevel: null,
    });
    const c = selectAccountShared(usePlannerStore.getState());
    expect(c).not.toBe(a);
    expect(c.tree.danoTotal).toBe(1.5);
  });

  it('hydrateAccount → selectAccountShared round-trips through normalizeAccount', () => {
    const shared: AccountShared = normalizeAccount({
      tree: { ...sampleTree },
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 2 },
      context: {
        houseIdx: 1,
        houseLevel: 3,
        phase: 40,
        mitigationPct: 0.9,
        rankMode: 'dps',
        targetProp: 'prop_a',
      },
    });
    usePlannerStore.getState().hydrateAccount(shared);
    const out = selectAccountShared(usePlannerStore.getState());
    expect(normalizeAccount(out)).toEqual(shared);
  });

  it('applyAccountImport writes only the handleImported subset', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: {
        danoTotal: 2,
        critChance: 1,
        critDmg: 2,
        speed: 3,
        energy: 4,
        glassCannon: true,
        tempoDobrado: true,
        teamCoinPct: 9,
        luckFlatPct: 5.3,
      },
      houseIdx: null,
      houseLevel: 99,
    });
    const s = usePlannerStore.getState();
    expect(s.treeDanoTotal).toBe(2);
    expect(s.treeTeamCoinPct).toBe(9);
    expect(s.treeLuckFlatPct).toBe(5.3);
    // houseLevel without houseIdx must not apply
    expect(s.houseIdx).toBe(0);
    expect(s.houseLevel).toBe(0);

    usePlannerStore.getState().applyAccountImport({
      tree: null,
      houseIdx: 2,
      houseLevel: 5,
    });
    expect(usePlannerStore.getState().houseIdx).toBe(2);
    expect(usePlannerStore.getState().houseLevel).toBe(5);
  });

  it('setTeamBuffs returns previous reference when shallow-equal', () => {
    const buffs = { ...zeroTeamBuffs(), grito_guerra: 1 };
    usePlannerStore.getState().setTeamBuffs(buffs);
    const ref = usePlannerStore.getState().teamBuffs;
    usePlannerStore.getState().setTeamBuffs({ ...buffs });
    expect(usePlannerStore.getState().teamBuffs).toBe(ref);
  });

  it('keystone setters are no-ops when value is unchanged', () => {
    const before = usePlannerStore.getState();
    before.setTreeGlassCannon(false);
    expect(usePlannerStore.getState()).toBe(before);
  });

  it('preserves full-precision tree floats through applyAccountImport (no UI round-trip)', () => {
    const precise = 2.60988968151606;
    usePlannerStore.getState().applyAccountImport({
      tree: {
        ...sampleTree,
        danoTotal: precise,
        critChance: 12.3456789,
        speed: 0.987654321,
      },
      houseIdx: null,
      houseLevel: null,
    });
    const s = usePlannerStore.getState();
    expect(s.treeDanoTotal).toBe(precise);
    expect(s.treeCritChance).toBe(12.3456789);
    expect(s.treeSpeed).toBe(0.987654321);
  });
});
