/** `@bombfarm/hero/model` — the view models and formatting the hero components render from. */
export { compareRosterHeroes, gearCountOf } from './roster-compare';
export { heroPowerText, orderByRollQuality } from './roster-rows';
export type { RosterHeroRow } from './roster-rows';
export {
  ROSTER_BOARD_SORT_KEYS,
  DEFAULT_ROSTER_BOARD_SORT,
  EMPTY_ROSTER_BOARD_FILTER,
  abilityFilterOptions,
  filterRosterRows,
  pressAbilityFilter,
  rosterRowsShown,
  sortRosterRows,
  toggleAbilityFilter,
} from './roster-board-order';
export type {
  RosterAbilityFilterOption,
  RosterBoardFilter,
  RosterBoardSort,
  RosterBoardSortDirection,
  RosterBoardSortKey,
} from './roster-board-order';
export { heroPickOutcome } from './roster-view-mode';
export type { HeroPickOutcome, RosterViewMode } from './roster-view-mode';
export {
  DEFAULT_ROSTER_CARD_DENSITY,
  ROSTER_CARD_DENSITIES,
  cardSectionsFor,
  isRosterCardDensity,
} from './roster-card-density';
export type {
  RosterCardAbilities,
  RosterCardDensity,
  RosterCardRoll,
  RosterCardSections,
} from './roster-card-density';
export { SHEET_STAT_CODES } from './sheet-stat-codes';
export { formatClearTime } from './format-clear-time';
export {
  birthRollAvailability,
  gradePlacementFor,
  gradeRailFor,
  heroPowerTextFor,
  marketTileReadingFor,
  marketValueReadingFor,
  marketableReadingFor,
  letterDisagreementFor,
  nextLetterReadout,
  statRollRowsFor,
} from './birth-roll-panel';
export type {
  FlagReading,
  HeroMarketPrice,
  MarketTileReading,
  MarketValueReading,
  GradePlacement,
  GradeRail,
  GradeRailBoundary,
  GradeRailSegment,
  LetterDisagreement,
  NextLetterReadout,
  PlacementCertainty,
  StatRollRow,
} from './birth-roll-panel';
export {
  abilityPanelAvailability,
  abilityPanelReading,
  abilityPointReadoutFor,
  abilityRowsFor,
  abilityStepAvailability,
  abilityValueText,
} from './ability-panel';
export type {
  AbilityPanelReading,
  AbilityPointReadout,
  AbilityRow,
  AbilityRowText,
  AbilityStepAvailability,
  AbilityValueCopy,
} from './ability-panel';
export {
  fuseNote,
  fuseReadoutFor,
  penetrationNote,
  penetrationReadingFor,
  propTableReadingFor,
  stageLabelFor,
} from './combat-panel';
export type {
  FuseNotes,
  FuseReadout,
  FuseSource,
  PenetrationNotes,
  PenetrationReading,
  PenetrationSource,
  PropTableReading,
  StageLabel,
  StageNotes,
} from './combat-panel';
export { railTintFor } from './roll-rail-tint';
export type { RollTint } from './roll-rail-tint';
export {
  SHEET_PCT_KEYS,
  sheetStatUnit,
  derivedLabel,
  formatBreakdownValue,
  groupLabel,
  isSheetKey,
  ledgerStepNote,
  ledgerStepText,
  rowValue,
  sourceLabel,
} from './breakdown-labels';
export {
  farmOptimizeNotice,
  farmOptimizeResultDisplay,
  hasApplicableGain,
  optimizeResultDisplay,
  previewResultDisplay,
} from './points-preview-copy';
export type { OptimizeResultDisplay, PointsPreview } from './points-preview-copy';
export { pointsPanelReading } from './points-panel';
export type { PointsPanelReading } from './points-panel';
export { formatBonus, gearBonusRows } from './gear-bonus-rows';
export type { GearBonusRow } from './gear-bonus-rows';
export { gearPanelReading } from './gear-panel';
export type { GearPanelReading } from './gear-panel';
export { renderTemplateWithPct } from './render-template-with-pct';
export { ownAbilityRowsFor, teamAuraRowsFor } from './abilities-auras-panel';
export type { OwnAbilityRow, OwnAbilityStatus, TeamAuraRow } from './abilities-auras-panel';
export {
  COMBAT_BREAKDOWN_CARDS,
  COMBAT_BREAKDOWN_EDGES,
  COMBAT_BREAKDOWN_ROWS,
  cardBadgesFor,
  cardForAbility,
  cardInputChips,
  cardInputs,
  cardNoteFor,
  cardOutputs,
  connectedCards,
  ledgerLines,
  matrixRowsFor,
  matrixShowsRunes,
  penetrationCardReading,
  breakdownCardData,
} from './combat-breakdown';
export type {
  BreakdownCardData,
  BreakdownEdge,
  BreakdownRow,
  BreakdownRowId,
  CardBadge,
  CardInputChip,
  CardNote,
  LedgerLine,
  MatrixCell,
  MatrixRow,
  PenetrationCardReading,
} from './combat-breakdown';
export {
  HERO_TYPE_IDS,
  HERO_TYPE_VOTERS,
  HERO_TYPE_MIN_VOTING_LEVEL,
  SECOND_HERO_TYPE_SHARE,
  WIDE_BLAST_ABILITY_ID,
  heroTypeLabel,
  heroTypeLabels,
  heroTypeOfAbility,
  heroTypesFor,
  wideBlastOf,
} from './hero-types';
export type { HeroTypeId, WideBlastReading } from './hero-types';
export { highestRollsFor, highestRollsText } from './highest-rolls';
export type { HighestRoll } from './highest-rolls';
export { equippedGearAverages, equippedItemsOf, isSquadHero, rosterSummaryFor } from './roster-summary';
export type { EquippedGearAverages, RarityCount, RosterSummary, SummaryHero } from './roster-summary';
export { auraCoverageFor } from './aura-coverage';
export type { AuraCoverage, AuraCoverageTile } from './aura-coverage';
export {
  LEADERBOARD_COLUMNS,
  LEADERBOARD_COLUMN_IDS,
  LEADERBOARD_FILTERS,
  LEADERBOARD_FILTER_LABELS,
  filterLeaderboardRows,
  heroStatSheet,
  leaderboardRowsFor,
  sortLeaderboardRows,
} from './roster-leaderboard';
export type {
  LeaderboardColumn,
  LeaderboardColumnId,
  LeaderboardFilter,
  LeaderboardRow,
  LeaderboardSortDirection,
  SortableLeaderboardColumnId,
} from './roster-leaderboard';
