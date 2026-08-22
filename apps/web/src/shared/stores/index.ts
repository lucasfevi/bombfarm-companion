/**
 * Public API for the planner store (MOD-05 / MOD-12).
 * Outside code imports hooks and named selectors only — never raw setState/getState.
 */
export { usePlannerStore, resetPlannerStoreForTests } from '@/shared/stores/planner-store';
export type { PlannerStore } from '@/shared/stores/planner-store';
export { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
export { attachPlannerPersistence } from '@/shared/stores/persistence/attach-persistence';
export { commitActiveHero } from '@/shared/stores/commit-active-hero';
export type { SessionSlice } from '@/shared/stores/slices/session-slice';
export type { AccountSlice } from '@/shared/stores/slices/account-slice';
export type { RosterSlice } from '@/shared/stores/slices/roster-slice';
export type { PhasesSlice } from '@/shared/stores/slices/phases-slice';
export type { HeroDraftSlice } from '@/shared/stores/slices/hero-draft-slice';
export {
  selectLang,
  selectToast,
  selectBooted,
  selectStrings,
} from '@/shared/stores/selectors/session-selectors';
export {
  selectAccountShared,
  selectAccountTuple,
  selectTreeDanoTotal,
  selectTreeCritChance,
  selectTreeCritDmg,
  selectTreeSpeed,
  selectTreeEnergy,
  selectTreeTeamCoinPct,
  selectTreeLuckFlatPct,
  selectTreeXpMult,
  selectTeamBuffsOverride,
  selectEffectiveTeamBuffs,
  resetEffectiveTeamBuffsCache,
  selectHouseIdx,
  selectHouseLevel,
  selectHouseCycleSecs,
  selectHouseCycleSecsHouseIdx,
  selectHouseCycleSecsLevel,
  selectFarmPhase,
  selectMitigationPct,
  selectRankMode,
  selectTargetProp,
  selectSlots,
  selectFieldSlots,
  selectMaxPhase,
  selectPlayerName,
  selectAccountId,
  selectTreeSquadDmgPct,
  selectTreeGeoMult,
  selectTreeFieldSlotsBonus,
  selectTreeBagTabsBonus,
} from '@/shared/stores/selectors/account-selectors';
export {
  selectTeamPlanIsStale,
  selectInventoryItems,
  selectScopeByHeroId,
  selectForgeFloor,
} from '@/shared/stores/selectors/team-plan-selectors';
export type { TeamPlanSlice } from '@/shared/stores/slices/team-plan-slice';
export {
  selectHeroes,
  selectActiveHeroId,
  selectActiveHero,
} from '@/shared/stores/selectors/roster-selectors';
export {
  selectDps,
  selectAdvisorPipeline,
  getAdvisorPipelineComputeCount,
  resetAdvisorPipelineCache,
  resetAdvisorPipelineComputeCount,
  readAdvisorDepTuple,
} from '@/shared/stores/selectors/advisor-selectors';
export {
  selectHeroesWithResetAdvice,
  resetResetAdviceRosterCache,
} from '@/shared/stores/selectors/reset-advice-roster-selectors';
export type { ResetAdviceRosterRow } from '@/shared/stores/selectors/reset-advice-roster-selectors';
export {
  selectHeroName,
  selectHeroRarity,
  selectHeroLevel,
  selectHeroStars,
  selectHeroSourceId,
  selectHeroRank,
  selectHeroBattleAllowed,
  selectHeroSkin,
  selectHeroStatPointsAvailable,
  selectShouldShowEmptyState,
  selectFormatNumber,
} from '@/shared/stores/selectors/hero-selectors';
export {
  selectPlannerTabStatuses,
  selectSetupReady,
  selectHeroTabStatus,
  selectGearTabStatus,
  selectPointsTabStatus,
  resetPlannerTabStatusCache,
} from '@/shared/stores/selectors/tab-status-selectors';
export {
  selectPhasesViewPhase,
  selectPhasesViewPhaseChosen,
} from '@/shared/stores/selectors/phases-selectors';
export { selectTreeSheetTotals } from '@/shared/stores/selectors/tree-sheet-selectors';
export {
  selectFarmRankingRows,
  selectFarmPoolEntries,
  deriveFarmPoolEntries,
  selectFarmReturnBonus,
  resetFarmRankingCache,
  getFarmRankingComputeCount,
  resetFarmRankingComputeCount,
  readFarmRespecDepTuple,
  computeFarmRespecShouldSurface,
  selectFarmRespecGate,
  getFarmRespecGateComputeCount,
  resetFarmRespecGateComputeCount,
  runFarmRespecSolve,
  getFarmRespecSolveCount,
  resetFarmRespecSolveCount,
  selectFarmRespecIsStale,
  selectFarmRespecView,
  selectFarmRespecStatus,
  selectFarmReRankActive,
  selectFarmBoardRows,
  getFarmRespecRowsComputeCount,
  resetFarmRespecRowsComputeCount,
} from '@/shared/stores/selectors/farm-ranking-selectors';
export type {
  FarmRankingResult,
  FarmRankingReason,
  FarmPoolEntry,
  FarmRespecGate,
  FarmRespecGateReason,
} from '@/shared/stores/selectors/farm-ranking-selectors';
export {
  selectFarmPoolBases,
  resetFarmPoolBasesCache,
  getFarmPoolBasesComputeCount,
  resetFarmPoolBasesComputeCount,
  selectDraftFarmBasis,
  resetDraftFarmBasisCache,
  getDraftFarmBasisComputeCount,
  resetDraftFarmBasisComputeCount,
  selectNextPointRanking,
  resetNextPointRankingCache,
  getNextPointRankingComputeCount,
  resetNextPointRankingComputeCount,
  getFarmRankComputeCount,
  resetFarmRankComputeCount,
  selectNextPointBest,
  selectBestStat,
  selectBestGainPct,
} from '@/shared/stores/selectors/next-point-selectors';
export type { NextPointRanking } from '@/shared/stores/selectors/next-point-selectors';
