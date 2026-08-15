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
  luckFlatPct: 6,
} as const;

describe('account slice', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('owns account tree defaults', () => {
    const s = usePlannerStore.getState();
    expect(s.treeDanoTotal).toBe(1);
    expect(s.treeCritChance).toBe(0);
    expect(s.treeTeamCoinPct).toBe(0);
    expect(s.treeLuckFlatPct).toBe(0);
    expect(s.teamBuffs).toEqual(zeroTeamBuffs());
    expect(s.houseIdx).toBe(0);
    expect(s.phase).toBeNull();
    expect(s.rankMode).toBe('farm');
    expect(s.targetProp).toBe('stone');
  });

  // MSC-03 — the three keystone setters are unrepresentable, not merely avoided: absent from
  // AccountSlice's TYPE (a TS2339 compile error to reference one — proven by
  // `pnpm --filter @bombfarm/web typecheck`) AND `undefined` on the runtime store object. The
  // type check alone does not prove the runtime object; this asserts it directly.
  it('setTreeGlassCannon / setTreeTempoDobrado / setTreeAbisso are undefined at runtime', () => {
    const state = usePlannerStore.getState() as unknown as Record<string, unknown>;
    expect(state.setTreeGlassCannon).toBeUndefined();
    expect(state.setTreeTempoDobrado).toBeUndefined();
    expect(state.setTreeAbisso).toBeUndefined();
  });

  it('AC-10: applyAccountImport writes luckFlatPct (no per-field tree setter)', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: { ...sampleTree, luckFlatPct: 5.3 },
      houseIdx: null,
      houseLevel: null,
      phase: null,
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
      phase: null,
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
        teamCoinPct: 9,
        luckFlatPct: 5.3,
      },
      houseIdx: null,
      houseLevel: 99,
      phase: null,
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
      phase: null,
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
      phase: null,
    });
    const s = usePlannerStore.getState();
    expect(s.treeDanoTotal).toBe(precise);
    expect(s.treeCritChance).toBe(12.3456789);
    expect(s.treeSpeed).toBe(0.987654321);
  });

  describe('applyAccountImport phase wiring (account.phase → store phase)', () => {
    it('writes phase and syncs mitigationPct from the phases.json wiki line', () => {
      usePlannerStore.getState().applyAccountImport({
        tree: null,
        houseIdx: null,
        houseLevel: null,
        phase: 151,
      });
      const s = usePlannerStore.getState();
      expect(s.phase).toBe(151);
      // phases.json line 151: mitig 0.13270451 -> 13.27%.
      expect(s.mitigationPct).toBeCloseTo(13.27, 2);
    });

    it('clamps an out-of-range save phase to 1..600 via effectiveFarmPhase', () => {
      usePlannerStore.getState().applyAccountImport({
        tree: null,
        houseIdx: null,
        houseLevel: null,
        phase: 9999,
      });
      expect(usePlannerStore.getState().phase).toBe(600);

      usePlannerStore.getState().applyAccountImport({
        tree: null,
        houseIdx: null,
        houseLevel: null,
        phase: -3,
      });
      expect(usePlannerStore.getState().phase).toBe(1);
    });

    it('leaves phase/mitigation untouched when the save has no account.phase', () => {
      usePlannerStore.getState().setFarmPhase(200);
      const before = usePlannerStore.getState();
      usePlannerStore.getState().applyAccountImport({
        tree: { ...sampleTree },
        houseIdx: null,
        houseLevel: null,
        phase: null,
      });
      const after = usePlannerStore.getState();
      expect(after.phase).toBe(before.phase);
      expect(after.mitigationPct).toBe(before.mitigationPct);
    });

    it('does not fight the hero-draft mitigation-sync suppression flag (ASM-10)', () => {
      usePlannerStore.getState().setMitigationPct(42);
      usePlannerStore.getState().setSkipPhaseMitigationSync(true);
      usePlannerStore.getState().applyAccountImport({
        tree: null,
        houseIdx: null,
        houseLevel: null,
        phase: 151,
      });
      const s = usePlannerStore.getState();
      // Phase itself still lands...
      expect(s.phase).toBe(151);
      // ...but mitigation stays whatever it was, exactly like setFarmPhase's own contract.
      expect(s.mitigationPct).toBe(42);
      usePlannerStore.getState().setSkipPhaseMitigationSync(false);
    });
  });
});
