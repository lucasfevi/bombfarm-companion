/** `@bombfarm/hero/model` — the view models and formatting the hero components render from. */
export { compareRosterHeroes, gearCountOf } from './roster-compare';
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
  combatFiguresShown,
} from './combat-panel';
export type {
  CombatFigureId,
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
  rowValue,
  sourceLabel,
} from './breakdown-labels';
export { FORMULA_GLOSSARY, resolveFormulaTerms } from './formula-glossary';
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
