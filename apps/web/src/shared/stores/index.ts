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
  selectTreeGlassCannon,
  selectTreeTempoDobrado,
  selectTeamBuffs,
  selectHouseIdx,
  selectHouseLevel,
  selectFarmPhase,
  selectMitigationPct,
  selectRankMode,
  selectTargetProp,
} from '@/shared/stores/selectors/account-selectors';
export {
  selectHeroes,
  selectActiveHeroId,
  selectActiveHero,
} from '@/shared/stores/selectors/roster-selectors';
export {
  selectDps,
  selectBestStat,
  selectBestGainPct,
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
  selectShouldShowEmptyState,
  selectFormatNumber,
} from '@/shared/stores/selectors/hero-selectors';
export {
  selectPlannerTabStatuses,
  selectSetupReady,
  selectHeroTabStatus,
  selectGearTabStatus,
  selectAccountTabStatus,
  selectPointsTabStatus,
  resetPlannerTabStatusCache,
} from '@/shared/stores/selectors/tab-status-selectors';
export { selectPhasesViewPhase } from '@/shared/stores/selectors/phases-selectors';
export { selectTreeSheetTotals } from '@/shared/stores/selectors/tree-sheet-selectors';
