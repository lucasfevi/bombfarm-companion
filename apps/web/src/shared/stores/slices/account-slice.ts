import type { StateCreator } from 'zustand';
import type { RankMode } from '@bombfarm/domain/model';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import { effectiveFarmPhase } from '@bombfarm/domain/farm-context';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import type { RequiredAccountField } from '@bombfarm/domain/account-required-fields';
import { phaseLine } from '@bombfarm/domain/phases';
import type { TeamBuffId } from '@bombfarm/domain/team-buffs';
import {
  DEFAULT_CONTEXT,
  DEFAULT_TREE,
  type AccountShared,
} from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';

function teamBuffsOverrideEqual(
  left: Record<TeamBuffId, number> | null,
  right: Record<TeamBuffId, number> | null,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
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
  /** `skills.totals.xp_mult` — scales `xpPerPropWiki` the same way `treeTeamCoinPct` scales
   *  gold per prop. `1` (not `0`) is the no-boost default, matching {@link TreeState.xpMult}. */
  treeXpMult: number;
  /** `team_dmg_add × 100` and `geo_mult` — the two factors `treeDanoTotal` is the product of.
   *  DISPLAY ONLY (the Account page shows the product); damage math reads `treeDanoTotal`. */
  treeSquadDmgPct: number;
  treeGeoMult: number;
  /** `vagas_campo` / `bag_tabs_bonus` — counts the tree grants, shown on the Account page. */
  treeFieldSlotsBonus: number;
  treeBagTabsBonus: number;
  /**
   * The user's explicit team-buffs OVERRIDE — `null` means "derive from the deployed roster"
   * (issue #132; see `selectEffectiveTeamBuffs`, `account-selectors.ts`). This is the ONLY
   * field the store itself tracks; the effective (override-or-derived) value is always computed,
   * never stored, so it can never go stale against the roster.
   */
  teamBuffsOverride: Record<TeamBuffId, number> | null;
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  rankMode: RankMode;
  targetProp: string | null;
  /** HOUSE RECOVERY slots (`casa.slots`) — how many heroes the House refills at a time. */
  slots: number;
  /**
   * FIELD slots (`skills.field_slots`) — how many heroes may be deployed at once. A different
   * game concept from {@link slots}, and a different number on a real save (6 vs 3 on account
   * 486). `null` when the last import carried no `skills.field_slots`, which sends the farm
   * board back to `slots` as a legacy fallback.
   */
  fieldSlots: number | null;
  /**
   * `casa.cycle_secs` — a full 0 → 100% House fill in seconds, straight off the save. `null`
   * falls the whole app back to the `HOUSES` table interpolation, accurate to the second. Feeds
   * `Context.restSeconds` for the advisor, the team plan and the farm board alike, so it belongs
   * to shared account state rather than to any one surface.
   */
  houseCycleSecs: number | null;
  /**
   * The (house, level) `houseCycleSecs` was captured at — the import's OWN `houseIdx`/
   * `houseLevel` at the moment it set `houseCycleSecs`, snapshotted separately from
   * {@link houseIdx}/{@link houseLevel} because THOSE are the live picker: `setHouseIdx`/
   * `setHouseLevel` move them without touching this. `resolveHouseRestSeconds` trusts
   * `houseCycleSecs` only while the picker sits on this exact pair — this is the fix for the
   * House-ceiling regression where a picker move stopped changing any computed number because a
   * mismatched save figure kept winning regardless of the requested house/level.
   */
  houseCycleSecsHouseIdx: number | null;
  houseCycleSecsLevel: number | null;
  /**
   * `account.max_phase`. `null` when the browser account predates this feature, was
   * assembled by hand, or the last import's payload carried neither source — `FarmRateOptions`
   * treats `null` as "show every phase, no lock badges".
   */
  maxPhase: number | null;
  /** `account.player_name` / `account.account_id` — the Account page header. `null` when the
   *  imported save carried neither (both are optional export keys). */
  playerName: string | null;
  accountId: string | null;
  /**
   * Issue #141 — required save fields the last import did not carry, or `null` when no import
   * has been checked against that rule (a fresh browser, or a record stored before the rule).
   * `null` and `[]` are NOT the same state: only a non-empty list raises the re-import banner,
   * and only `[]` is a positive statement that the stored account is complete.
   */
  missingRequiredFields: readonly RequiredAccountField[] | null;

  setTeamBuffsOverride: (value: Record<TeamBuffId, number> | null) => void;
  setHouseIdx: (value: number) => void;
  setHouseLevel: (value: number) => void;
  setFarmPhase: (value: number | null) => void;
  setMitigationPct: (value: number) => void;
  setRankMode: (value: RankMode) => void;
  setTargetProp: (value: string | null) => void;

  hydrateAccount: (shared: AccountShared) => void;
  applyAccountImport: (data: AccountImportData, missingRequired?: readonly RequiredAccountField[]) => void;
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
  treeXpMult: defaultTree.xpMult ?? 1,
  treeSquadDmgPct: defaultTree.squadDmgPct ?? 0,
  treeGeoMult: defaultTree.geoMult ?? 1,
  treeFieldSlotsBonus: defaultTree.fieldSlotsBonus ?? 0,
  treeBagTabsBonus: defaultTree.bagTabsBonus ?? 0,
  teamBuffsOverride: null,
  houseIdx: defaultCtx.houseIdx,
  houseLevel: defaultCtx.houseLevel,
  phase: defaultCtx.phase,
  mitigationPct: defaultCtx.mitigationPct,
  rankMode: defaultCtx.rankMode,
  targetProp: defaultCtx.targetProp,
  slots: DEFAULT_CASA_SLOTS,
  fieldSlots: null,
  houseCycleSecs: null,
  houseCycleSecsHouseIdx: null,
  houseCycleSecsLevel: null,
  maxPhase: null,
  playerName: null,
  accountId: null,
  missingRequiredFields: null,

  setTeamBuffsOverride: (value) => {
    if (teamBuffsOverrideEqual(get().teamBuffsOverride, value)) return;
    set({ teamBuffsOverride: value });
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
      treeXpMult: shared.tree.xpMult ?? 1,
      treeSquadDmgPct: shared.tree.squadDmgPct ?? 0,
      treeGeoMult: shared.tree.geoMult ?? 1,
      treeFieldSlotsBonus: shared.tree.fieldSlotsBonus ?? 0,
      treeBagTabsBonus: shared.tree.bagTabsBonus ?? 0,
      // `shared` already went through `normalizeAccount` (issue #132) — `teamBuffsOverride` is
      // `null` (derive from the roster) or an already-clean `Record<TeamBuffId, number>`.
      teamBuffsOverride: shared.teamBuffsOverride ?? null,
      houseIdx: shared.context.houseIdx,
      houseLevel: shared.context.houseLevel,
      phase: shared.context.phase,
      mitigationPct: shared.context.mitigationPct,
      rankMode: shared.context.rankMode,
      targetProp: shared.context.targetProp,
      slots: shared.slots ?? DEFAULT_CASA_SLOTS,
      fieldSlots: shared.fieldSlots ?? null,
      houseCycleSecs: shared.houseCycleSecs ?? null,
      houseCycleSecsHouseIdx: shared.houseCycleSecsHouseIdx ?? null,
      houseCycleSecsLevel: shared.houseCycleSecsLevel ?? null,
      maxPhase: shared.maxPhase ?? null,
      playerName: shared.playerName ?? null,
      accountId: shared.accountId ?? null,
      missingRequiredFields: shared.missingRequiredFields ?? null,
    });
  },

  applyAccountImport: (data, missingRequired) => {
    const patch: Partial<AccountSlice> = {};
    if (data.tree) {
      patch.treeDanoTotal = data.tree.danoTotal;
      patch.treeCritChance = data.tree.critChance;
      patch.treeCritDmg = data.tree.critDmg;
      patch.treeSpeed = data.tree.speed;
      patch.treeEnergy = data.tree.energy;
      patch.treeTeamCoinPct = data.tree.teamCoinPct ?? 0;
      patch.treeLuckFlatPct = data.tree.luckFlatPct;
      patch.treeXpMult = data.tree.xpMult ?? 1;
      patch.treeSquadDmgPct = data.tree.squadDmgPct ?? 0;
      patch.treeGeoMult = data.tree.geoMult ?? 1;
      patch.treeFieldSlotsBonus = data.tree.fieldSlotsBonus ?? 0;
      patch.treeBagTabsBonus = data.tree.bagTabsBonus ?? 0;
    }
    if (data.houseIdx != null) {
      patch.houseIdx = data.houseIdx;
      if (data.houseLevel != null) patch.houseLevel = data.houseLevel;
    }
    if (data.slots != null) patch.slots = data.slots;
    // UNCONDITIONAL, for the same reason `maxPhase` below is: both readers are total
    // (`number | null` on every path), so absence is the payload ASSERTING this account has no
    // `skills.field_slots` / `casa.cycle_secs`, not a section it declined to send. Keeping a
    // stale field cap or a stale House cycle would score the board against a house the player
    // no longer has.
    patch.fieldSlots = data.fieldSlots ?? null;
    patch.houseCycleSecs = data.houseCycleSecs ?? null;
    // The anchor rides along with `houseCycleSecs`, UNCONDITIONALLY for the same reason: it is
    // `data.houseIdx`/`data.houseLevel` at THIS import (not `patch.houseIdx`/`houseLevel` above,
    // which stay untouched by a re-import that carries no `casa` block) — the house/level pair
    // `data.houseCycleSecs` was measured at. A payload with no `casa` block sets both to `null`,
    // matching `houseCycleSecs` going `null` on the same line, so the anchor can never outlive
    // the figure it anchors.
    patch.houseCycleSecsHouseIdx = data.houseIdx ?? null;
    patch.houseCycleSecsLevel = data.houseLevel ?? null;
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
    // UNCONDITIONAL, unlike every sibling field above.
    // AccountImportData.maxPhase is required-and-total (number | null on every path), so a
    // payload carrying no max_phase source is an ASSERTION that this account has no known max
    // phase, not an absence to be ignored. Preserving a stale value here would leave lock
    // badges asserting progress the payload just contradicted (D24's "confidently wrong"
    // shape). Both the file-import and API-refresh paths reach this branch — both funnel
    // through parseAccountPayload -> mapAccountData.
    // `data.maxPhase` is optional on AccountImportData's TYPE only so hand-built test fixtures
    // elsewhere keep compiling (see that type's own doc comment) — real production data always carries a
    // concrete `number | null`. Coerce a merely-absent field to `null` so the slice's own
    // `number | null` invariant never sees `undefined`.
    patch.maxPhase = data.maxPhase ?? null;
    // UNCONDITIONAL, same reasoning as `maxPhase`: a re-import from a DIFFERENT account that
    // carries no identity must not leave the previous account's name in the page header.
    patch.playerName = data.playerName ?? null;
    patch.accountId = data.accountId ?? null;
    // UNCONDITIONAL, and `[]` rather than `null` when the caller passes nothing: reaching this
    // function at all means an import happened, so the "never checked" state (`null`) is over
    // either way. A caller that does not supply the parse's verdict is asserting the account is
    // complete — the pre-#141 assumption, now written down instead of implied.
    patch.missingRequiredFields = missingRequired ?? [];
    if (Object.keys(patch).length > 0) set(patch);
  },
});
