/** `@bombfarm/hero/model` — the view models and formatting the hero components render from. */
export { compareRosterHeroes, gearCountOf } from './roster-compare';
export { formatClearTime } from './format-clear-time';
export {
  birthRollAvailability,
  gradePlacementFor,
  gradeRailFor,
  identityFlagsFor,
  letterDisagreementFor,
  nextLetterReadout,
  statRollRowsFor,
} from './birth-roll-panel';
export type {
  FlagReading,
  GradePlacement,
  GradeRail,
  GradeRailBoundary,
  GradeRailSegment,
  IdentityFlags,
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
export { railTintFor } from './roll-rail-tint';
export type { RollTint } from './roll-rail-tint';
