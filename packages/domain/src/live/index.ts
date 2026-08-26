export type { FrameClockState, HeroEnergyClockState } from './drain-slope';
export {
  EMPTY_HERO_ENERGY_CLOCK,
  INITIAL_FRAME_CLOCK_STATE,
  MAX_TRUSTED_DRAIN_RATE,
  MIN_FRAME_CLOCK_SAMPLES,
  MIN_TRUSTED_DRAIN_RATE,
  advanceFrameClock,
  advanceHeroEnergyClock,
  measuredSecondsPerFrame,
} from './drain-slope';

export type {
  DrainMultipliers,
  DrainRejectionReport,
  FieldCountdownInput,
  FieldCountdownResult,
  FieldCountdownState,
} from './field-countdown';
export {
  createInitialFieldCountdownState,
  freezeRecoveryCountdowns,
  ingestFieldCountdownTick,
} from './field-countdown';

export type { RosterHeroAbilities } from './drain-multipliers';
export { resolveFieldDrainMultipliers } from './drain-multipliers';
export { extractRosterHeroAbilities } from './roster-ability-ranks';
