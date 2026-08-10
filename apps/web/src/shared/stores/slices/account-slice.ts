import type { StateCreator } from 'zustand';
import type { RankMode } from '@bombfarm/domain/model';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import { effectiveFarmPhase } from '@bombfarm/domain/farm-context';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs, type TeamBuffId } from '@bombfarm/domain/team-buffs';
import {
  DEFAULT_CONTEXT,
  DEFAULT_TREE,
  type AccountShared,
} from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';

function teamBuffsEqual(
  left: Record<TeamBuffId, number>,
  right: Record<TeamBuffId, number>,
): boolean {
  for (const buffId of Object.keys(left) as TeamBuffId[]) {
    if (left[buffId] !== right[buffId]) return false;
  }
  return true;
}

export type AccountSlice = {
  treeDanoTotal: number;
  treeCritChance: number;
  treeCritDmg: number;
  treeSpeed: number;
  treeEnergy: number;
  treeTeamCoinPct: number;
  treeGlassCannon: boolean;
  treeTempoDobrado: boolean;
  treeAbisso: boolean;
  /** `skills.totals.abisso_base` — Abisso's damage-multiplier exponent base; import-only. */
  treeAbissoBase: number;
  /**
   * `skills.totals.crit_dmg_mult` — Glass Cannon's crit-damage multiplier on the birth base
   * (2 when C15 is owned, 1 otherwise); import/hydrate-only, same shape as `treeAbissoBase`.
   */
  treeCritDmgMult: number;
  treeLuckFlatPct: number;
  teamBuffs: Record<TeamBuffId, number>;
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  rankMode: RankMode;
  targetProp: string | null;
  slots: number;

  /** Keystones stay editable for what-if; numeric tree totals are import/hydrate only. */
  setTreeGlassCannon: (value: boolean) => void;
  setTreeTempoDobrado: (value: boolean) => void;
  setTreeAbisso: (value: boolean) => void;
  setTeamBuffs: (value: Record<TeamBuffId, number>) => void;
  setHouseIdx: (value: number) => void;
  setHouseLevel: (value: number) => void;
  setFarmPhase: (value: number | null) => void;
  setMitigationPct: (value: number) => void;
  setRankMode: (value: RankMode) => void;
  setTargetProp: (value: string | null) => void;

  hydrateAccount: (shared: AccountShared) => void;
  applyAccountImport: (data: AccountImportData) => void;
};

const defaultTree = DEFAULT_TREE();
const defaultCtx = DEFAULT_CONTEXT();

export const createAccountSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  AccountSlice
> = (set, get) => ({
  treeDanoTotal: defaultTree.danoTotal,
  treeCritChance: defaultTree.critChance,
  treeCritDmg: defaultTree.critDmg,
  treeSpeed: defaultTree.speed,
  treeEnergy: defaultTree.energy,
  treeTeamCoinPct: defaultTree.teamCoinPct,
  treeGlassCannon: defaultTree.glassCannon,
  treeTempoDobrado: defaultTree.tempoDobrado,
  treeAbisso: defaultTree.abisso ?? false,
  treeAbissoBase: defaultTree.abissoBase ?? 0,
  treeCritDmgMult: defaultTree.critDmgMult ?? 1,
  treeLuckFlatPct: defaultTree.luckFlatPct ?? 0,
  teamBuffs: zeroTeamBuffs(),
  houseIdx: defaultCtx.houseIdx,
  houseLevel: defaultCtx.houseLevel,
  phase: defaultCtx.phase,
  mitigationPct: defaultCtx.mitigationPct,
  rankMode: defaultCtx.rankMode,
  targetProp: defaultCtx.targetProp,
  slots: DEFAULT_CASA_SLOTS,

  setTreeGlassCannon: (value) => {
    if (get().treeGlassCannon === value) return;
    set({ treeGlassCannon: value });
  },
  setTreeTempoDobrado: (value) => {
    if (get().treeTempoDobrado === value) return;
    set({ treeTempoDobrado: value });
  },
  setTreeAbisso: (value) => {
    if (get().treeAbisso === value) return;
    set({ treeAbisso: value });
  },
  setTeamBuffs: (value) => {
    if (teamBuffsEqual(get().teamBuffs, value)) return;
    set({ teamBuffs: value });
  },
  setHouseIdx: (value) => {
    if (get().houseIdx === value) return;
    set({ houseIdx: value });
  },
  setHouseLevel: (value) => {
    if (get().houseLevel === value) return;
    set({ houseLevel: value });
  },
  setFarmPhase: (value) => {
    if (get().phase === value) return;
    const patch: Partial<AccountSlice> = { phase: value };
    const state = get();
    if (!state.skipPhaseMitigationSync && value != null) {
      const line = phaseLine(value);
      if (line) patch.mitigationPct = +(line.mitig * 100).toFixed(2);
    }
    set(patch);
  },
  setMitigationPct: (value) => {
    if (get().mitigationPct === value) return;
    set({ mitigationPct: value });
  },
  setRankMode: (value) => {
    if (get().rankMode === value) return;
    set({ rankMode: value });
  },
  setTargetProp: (value) => {
    if (get().targetProp === value) return;
    set({ targetProp: value });
  },

  hydrateAccount: (shared) => {
    set({
      treeDanoTotal: shared.tree.danoTotal,
      treeCritChance: shared.tree.critChance,
      treeCritDmg: shared.tree.critDmg,
      treeSpeed: shared.tree.speed,
      treeEnergy: shared.tree.energy,
      treeTeamCoinPct: shared.tree.teamCoinPct ?? 0,
      treeGlassCannon: shared.tree.glassCannon,
      treeTempoDobrado: shared.tree.tempoDobrado,
      treeAbisso: shared.tree.abisso ?? false,
      treeAbissoBase: shared.tree.abissoBase ?? 0,
      treeCritDmgMult: shared.tree.critDmgMult ?? 1,
      treeLuckFlatPct: shared.tree.luckFlatPct ?? 0,
      teamBuffs: {
        ...zeroTeamBuffs(),
        ...(shared.teamBuffs as Record<TeamBuffId, number>),
      },
      houseIdx: shared.context.houseIdx,
      houseLevel: shared.context.houseLevel,
      phase: shared.context.phase,
      mitigationPct: shared.context.mitigationPct,
      rankMode: shared.context.rankMode,
      targetProp: shared.context.targetProp,
      slots: shared.slots ?? DEFAULT_CASA_SLOTS,
    });
  },

  applyAccountImport: (data) => {
    const patch: Partial<AccountSlice> = {};
    if (data.tree) {
      patch.treeDanoTotal = data.tree.danoTotal;
      patch.treeCritChance = data.tree.critChance;
      patch.treeCritDmg = data.tree.critDmg;
      patch.treeSpeed = data.tree.speed;
      patch.treeEnergy = data.tree.energy;
      patch.treeTeamCoinPct = data.tree.teamCoinPct ?? 0;
      patch.treeGlassCannon = data.tree.glassCannon;
      patch.treeTempoDobrado = data.tree.tempoDobrado;
      patch.treeAbisso = data.tree.abisso;
      patch.treeAbissoBase = data.tree.abissoBase;
      patch.treeCritDmgMult = data.tree.critDmgMult;
      patch.treeLuckFlatPct = data.tree.luckFlatPct;
    }
    if (data.houseIdx != null) {
      patch.houseIdx = data.houseIdx;
      if (data.houseLevel != null) patch.houseLevel = data.houseLevel;
    }
    if (data.slots != null) patch.slots = data.slots;
    if (data.phase != null) {
      // Same clamp `setFarmPhase` relies on downstream reads for (AD-BSP style: reuse, don't
      // reimplement) — and the same mitigation-sync/skipPhaseMitigationSync contract as
      // `setFarmPhase` below, so an import landing mid hero-switch (ASM-10's suppression
      // window) doesn't fight it.
      const phase = effectiveFarmPhase(data.phase);
      patch.phase = phase;
      if (!get().skipPhaseMitigationSync) {
        const line = phaseLine(phase);
        if (line) patch.mitigationPct = +(line.mitig * 100).toFixed(2);
      }
    }
    if (Object.keys(patch).length > 0) set(patch);
  },
});
