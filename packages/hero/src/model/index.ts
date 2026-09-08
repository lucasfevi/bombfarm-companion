/** `@bombfarm/hero/model` — the view models and formatting the hero components render from. */
export { compareRosterHeroes, gearCountOf } from './roster-compare';
export { formatClearTime } from './format-clear-time';
export {
  birthRollAvailability,
  gradePlacementFor,
  gradeRailFor,
  marketValueReadingFor,
  marketableReadingFor,
  letterDisagreementFor,
  nextLetterReadout,
  statRollRowsFor,
} from './birth-roll-panel';
export type {
  FlagReading,
  HeroMarketPrice,
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
  abilityPointReadoutFor,
  abilityRowsFor,
  abilitySlotReadoutFor,
  abilityValueText,
  deadPointNote,
} from './ability-panel';
export type {
  AbilityPointReadout,
  AbilityRow,
  AbilityRowText,
  AbilitySlotReadout,
  AbilityValueCopy,
  DeadPointNotes,
  DeadPointReading,
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
