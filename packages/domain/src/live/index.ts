export type { DrainFit, DrainFitRejectionReason, DrainSample } from './drain-slope';
export {
  MAX_SAMPLE_AGE_MS,
  MAX_TRUSTED_DRAIN_RATE,
  MAX_WINDOW_SAMPLES,
  MIN_TRUSTED_DRAIN_RATE,
  MIN_TRUSTED_R_SQUARED,
  MIN_TRUSTED_SAMPLES,
  MIN_TRUSTED_SPAN_MS,
  fitDrainRate,
  pushDrainSample,
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
