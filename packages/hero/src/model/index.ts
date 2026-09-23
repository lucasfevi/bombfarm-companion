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
export { ROSTER_VIEW_MODES, heroPickOutcome } from './roster-view-mode';
export type { HeroPickOutcome, RosterViewMode } from './roster-view-mode';
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
  sheetTotalText,
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
export { highestRollsFor } from './highest-rolls';
export type { HighestRoll } from './highest-rolls';
export { equippedGearAverages, equippedItemsOf, isSquadHero, rosterSummaryFor } from './roster-summary';
export type { EquippedGearAverages, RarityCount, RosterSummary } from './roster-summary';
export {
  DEFAULT_SHOWCASE_VIEW,
  SHOWCASE_ABILITY_GAP_PX,
  SHOWCASE_CARD_BORDER_PX,
  SHOWCASE_CARD_MIN_WIDTH_PX,
  SHOWCASE_CARD_PADDING_PX,
  SHOWCASE_GEAR_GAP_PX,
  SHOWCASE_GEAR_SLOTS,
  SHOWCASE_MAX_ABILITIES,
  SHOWCASE_TILE_SIZE,
  gearAverageFigures,
  percentText,
  rowWidthPx,
  showcaseCardContentWidthPx,
  showcaseCardReading,
  showcaseTileWidthCss,
  showcaseTileWidthPx,
  squadGearAveragesText,
} from './showcase-card';
export type { GearAverageFigures, ShowcaseBirthReading, ShowcaseCardReading, ShowcaseView } from './showcase-card';
export { auraCoverageFor } from './aura-coverage';
export type { AuraCoverage, AuraCoverageTile } from './aura-coverage';
export {
  DEFAULT_HIDDEN_LEADERBOARD_COLUMNS,
  DEFAULT_LEADERBOARD_SORT,
  DEFAULT_LEADERBOARD_VIEW,
  LEADERBOARD_COLUMNS,
  LEADERBOARD_COLUMN_IDS,
  LEADERBOARD_FILTERS,
  LEADERBOARD_FILTER_LABELS,
  LEADERBOARD_STAT_COLUMN_IDS,
  TOGGLEABLE_LEADERBOARD_COLUMN_IDS,
  filterLeaderboardRows,
  heroPeekStats,
  heroPeekStatsResolver,
  heroStatSheet,
  isLeaderboardColumnShown,
  isLeaderboardStatColumn,
  leaderboardGearText,
  leaderboardMinWidthRem,
  leaderboardPowerPercent,
  leaderboardRowsFor,
  leaderboardStatValue,
  pressLeaderboardColumn,
  sortLeaderboardRows,
  withShownLeaderboardColumns,
  shownToggleableLeaderboardColumns,
  isToggleableLeaderboardColumn,
  treeSheetFromAccountTree,
  visibleLeaderboardColumns,
} from './roster-leaderboard';
export type {
  AccountTreeTotals,
  HeroStatSource,
  LeaderboardColumn,
  LeaderboardColumnId,
  LeaderboardFilter,
  LeaderboardRow,
  LeaderboardSort,
  LeaderboardSortDirection,
  LeaderboardStatSource,
  LeaderboardStatColumnId,
  LeaderboardView,
  SortableLeaderboardColumnId,
  StatSheetHero,
  ToggleableLeaderboardColumnId,
} from './roster-leaderboard';
export {
  EMPTY_SHARE_PICKER_FILTER,
  SHARE_FEATURED_COUNT,
  SHARE_MAX_STARS,
  clampSharePhase,
  compareByPower,
  defaultShareCardSettings,
  featuredRows,
  filterSharePickerRows,
  initialSharePhase,
  shareCardLayout,
  shareCardTotals,
  shareDpsText,
  sharePickerRarities,
  sharePicksFor,
  shareRarityIndex,
  shareStars,
  togglePick,
  toggleSharePickerRarity,
} from './share-card';
export type {
  ShareCardLayout,
  ShareCardSettings,
  ShareCardTotals,
  SharePickShortcut,
  SharePickerFilter,
} from './share-card';
export {
  POWER_ATTACK_RANGE_MULTIPLE,
  POWER_ROW_AXES,
  POWER_ROW_IDS,
  axisFraction,
  axisValueAtFraction,
  clampToAxis,
  formatAxisValue,
  formatMultiplier,
  formatPowerDelta,
  formatPowerFigure,
  formatShare,
  isGuideKey,
  powerAxisSpec,
  powerChartSeries,
  powerFactorRows,
  powerReading,
  powerReadoutText,
  steppedGuide,
} from './power-breakdown';
export type {
  GuideKey,
  PowerAxisSpec,
  PowerChartSeries,
  PowerFactorRow,
  PowerReading,
  PowerRowId,
} from './power-breakdown';
