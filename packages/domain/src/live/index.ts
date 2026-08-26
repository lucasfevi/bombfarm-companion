export type { DrainObservationResult, HeroDrainObservation } from './drain-checker';
export {
  DRAIN_RATE_DISAGREEMENT_MARGIN,
  drainRateDisagrees,
  EMPTY_HERO_DRAIN_OBSERVATION,
  observeDrainRate,
} from './drain-checker';

export type {
  AdvanceRecoveryClockResult,
  DrainDisagreementReport,
  DrainMultipliers,
  FieldCountdownInput,
  FieldCountdownResult,
  FieldCountdownState,
} from './field-countdown';
export { advanceRecoveryClock, createInitialFieldCountdownState, ingestFieldCountdownTick } from './field-countdown';

export type { RosterHeroAbilities } from './drain-multipliers';
export { resolveFieldDrainMultipliers } from './drain-multipliers';
export { extractRosterHeroAbilities } from './roster-ability-ranks';
