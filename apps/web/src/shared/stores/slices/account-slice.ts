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
  treeLuckFlatPct: number;
  teamBuffs: Record<TeamBuffId, number>;
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  rankMode: RankMode;
  targetProp: string | null;
  slots: number;
  /**
   * `account.max_phase` (`OD-9`). `null` when the browser account predates this feature, was
   * assembled by hand, or the last import's payload carried neither source — `FarmRateOptions`
   * treats `null` as "show every phase, no lock badges" (`AD-PFR-02`).
   */
  maxPhase: number | null;

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
  treeLuckFlatPct: defaultTree.luckFlatPct ?? 0,
  teamBuffs: zeroTeamBuffs(),
  houseIdx: defaultCtx.houseIdx,
  houseLevel: defaultCtx.houseLevel,
  phase: defaultCtx.phase,
  mitigationPct: defaultCtx.mitigationPct,
  rankMode: defaultCtx.rankMode,
  targetProp: defaultCtx.targetProp,
  slots: DEFAULT_CASA_SLOTS,
  maxPhase: null,

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
      maxPhase: shared.maxPhase ?? null,
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
    // OD-9 / AD-PFRC-04: UNCONDITIONAL, unlike every sibling field above. Item B's
    // AccountImportData.maxPhase is required-and-total (number | null on every path), so a
    // payload carrying no max_phase source is an ASSERTION that this account has no known max
    // phase, not an absence to be ignored. Preserving a stale value here would leave lock
    // badges asserting progress the payload just contradicted (D24's "confidently wrong"
    // shape). Both the file-import and API-refresh paths reach this branch — both funnel
    // through parseAccountPayload -> mapAccountData.
    // `data.maxPhase` is optional on AccountImportData's TYPE only so hand-built test fixtures
    // elsewhere keep compiling (item B's doc comment) — real production data always carries a
    // concrete `number | null`. Coerce a merely-absent field to `null` so the slice's own
    // `number | null` invariant never sees `undefined`.
    patch.maxPhase = data.maxPhase ?? null;
    if (Object.keys(patch).length > 0) set(patch);
  },
});
