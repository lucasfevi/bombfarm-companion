import type { StateCreator } from 'zustand';
import type { RankMode } from '@bombfarm/domain/model';
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
  treeLuckFlatPct: number;
  teamBuffs: Record<TeamBuffId, number>;
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  rankMode: RankMode;
  targetProp: string | null;

  setTreeDanoTotal: (value: number) => void;
  setTreeCritChance: (value: number) => void;
  setTreeCritDmg: (value: number) => void;
  setTreeSpeed: (value: number) => void;
  setTreeEnergy: (value: number) => void;
  setTreeTeamCoinPct: (value: number) => void;
  setTreeGlassCannon: (value: boolean) => void;
  setTreeTempoDobrado: (value: boolean) => void;
  setTreeLuckFlatPct: (value: number) => void;
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
  treeLuckFlatPct: defaultTree.luckFlatPct ?? 0,
  teamBuffs: zeroTeamBuffs(),
  houseIdx: defaultCtx.houseIdx,
  houseLevel: defaultCtx.houseLevel,
  phase: defaultCtx.phase,
  mitigationPct: defaultCtx.mitigationPct,
  rankMode: defaultCtx.rankMode,
  targetProp: defaultCtx.targetProp,

  setTreeDanoTotal: (value) => {
    if (get().treeDanoTotal === value) return;
    set({ treeDanoTotal: value });
  },
  setTreeCritChance: (value) => {
    if (get().treeCritChance === value) return;
    set({ treeCritChance: value });
  },
  setTreeCritDmg: (value) => {
    if (get().treeCritDmg === value) return;
    set({ treeCritDmg: value });
  },
  setTreeSpeed: (value) => {
    if (get().treeSpeed === value) return;
    set({ treeSpeed: value });
  },
  setTreeEnergy: (value) => {
    if (get().treeEnergy === value) return;
    set({ treeEnergy: value });
  },
  setTreeTeamCoinPct: (value) => {
    if (get().treeTeamCoinPct === value) return;
    set({ treeTeamCoinPct: value });
  },
  setTreeGlassCannon: (value) => {
    if (get().treeGlassCannon === value) return;
    set({ treeGlassCannon: value });
  },
  setTreeTempoDobrado: (value) => {
    if (get().treeTempoDobrado === value) return;
    set({ treeTempoDobrado: value });
  },
  setTreeLuckFlatPct: (value) => {
    if (get().treeLuckFlatPct === value) return;
    set({ treeLuckFlatPct: value });
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
      patch.treeLuckFlatPct = data.tree.luckFlatPct;
    }
    if (data.houseIdx != null) {
      patch.houseIdx = data.houseIdx;
      if (data.houseLevel != null) patch.houseLevel = data.houseLevel;
    }
    if (Object.keys(patch).length > 0) set(patch);
  },
});
