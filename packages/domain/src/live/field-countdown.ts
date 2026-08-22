import type {
  CountdownBasis,
  FieldCountdown,
  LiveTick,
  RecoveryCountdown,
  RotationHeroSnapshot,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { combineDrainRate } from '../drain';
import { recoverySecondsFor } from '../rotation-status';
import { fitDrainRate, pushDrainSample, type DrainSample } from './drain-slope';

export interface DrainMultipliers {
  readonly selfDrainMult: number;
  readonly teamDrainMult: number;
}

/** No reduction known for a hero (not yet resolved by the caller) is the same as the base
 *  law's unreduced rate — `combineDrainRate(1, 1)`. */
const UNRESOLVED_DRAIN_MULTIPLIERS: DrainMultipliers = { selfDrainMult: 1, teamDrainMult: 1 };

export interface DrainRejectionReport {
  readonly heroId: string;
  readonly reason: 'rateOutOfRange';
}

interface HeroDrainState {
  readonly window: readonly DrainSample[];
  readonly hasReportedRejection: boolean;
}

const EMPTY_HERO_DRAIN_STATE: HeroDrainState = { window: [], hasReportedRejection: false };

export interface FieldCountdownState {
  readonly onFieldHeroIds: ReadonlySet<string>;
  readonly heroDrainStates: ReadonlyMap<string, HeroDrainState>;
  readonly recovery: readonly RecoveryCountdown[];
}

export function createInitialFieldCountdownState(): FieldCountdownState {
  return { onFieldHeroIds: new Set(), heroDrainStates: new Map(), recovery: [] };
}

export interface FieldCountdownInput {
  readonly tick: LiveTick;
  readonly rotation: RotationSnapshot | null;
  readonly atMs: number;
  readonly modelledDrainMultipliers?: ReadonlyMap<string, DrainMultipliers>;
  /** `'tap'` (the default) is a genuine live-stream frame and may feed the observed-slope fit.
   *  `'rest'` is an authenticated-refresh reading standing in for one: real energy values, but at
   *  ~60s spacing rather than the ~10Hz the fit's trust gates were tuned for, so it must never earn
   *  an `observed` basis no matter how cleanly it would otherwise fit a line. */
  readonly sampleSource?: 'tap' | 'rest';
}

export interface FieldCountdownResult {
  readonly state: FieldCountdownState;
  readonly field: readonly FieldCountdown[];
  readonly recovery: readonly RecoveryCountdown[];
  readonly rejections: readonly DrainRejectionReport[];
}

function sameMembership(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function computeRecovery(rotation: RotationSnapshot | null): readonly RecoveryCountdown[] {
  const cycleSeconds = rotation?.house?.cycleSeconds;
  if (rotation === null || cycleSeconds === undefined) return [];

  const recovery: RecoveryCountdown[] = [];
  for (const hero of rotation.heroes) {
    if (hero.activity !== 'resting' || hero.recovering !== true) continue;
    const recoverySeconds = recoverySecondsFor(hero, cycleSeconds);
    if (recoverySeconds === undefined) continue;
    recovery.push({
      heroId: hero.id,
      secondsRemaining: Math.max(0, recoverySeconds),
      advancing: true,
    });
  }
  return recovery;
}

/**
 * Assembles the live view's field and recovery countdowns from one frame. A hero's basis is
 * `'observed'` only when its rolling window carries a trusted fit; any field-membership change
 * this tick drops every remaining hero's samples, since an aura carrier's arrival or departure
 * changes everyone else's true drain rate, not just the hero that moved.
 */
export function ingestFieldCountdownTick(
  state: FieldCountdownState,
  input: FieldCountdownInput,
): FieldCountdownResult {
  const { tick, rotation, atMs, modelledDrainMultipliers, sampleSource = 'tap' } = input;

  const heroSnapshotById = new Map<string, RotationHeroSnapshot>();
  for (const hero of rotation?.heroes ?? []) heroSnapshotById.set(hero.id, hero);

  const newFieldIds = new Set(tick.heroes.map((hero) => hero.id));
  const membershipChanged = !sameMembership(newFieldIds, state.onFieldHeroIds);

  const heroDrainStates = new Map<string, HeroDrainState>();
  for (const [heroId, drainState] of state.heroDrainStates) {
    if (!newFieldIds.has(heroId)) continue; // departed: discard, start clean on return
    heroDrainStates.set(heroId, membershipChanged ? { ...drainState, window: [] } : drainState);
  }

  const rejections: DrainRejectionReport[] = [];
  const field: FieldCountdown[] = [];

  for (const hero of tick.heroes) {
    const heroSnapshot = heroSnapshotById.get(hero.id);
    const energyMax = heroSnapshot?.energyMax;
    const absoluteEnergyNow =
      hero.energyFraction !== undefined && energyMax !== undefined && energyMax > 0
        ? hero.energyFraction * energyMax
        : undefined;

    let drainState = heroDrainStates.get(hero.id) ?? EMPTY_HERO_DRAIN_STATE;
    if (absoluteEnergyNow !== undefined && sampleSource === 'tap') {
      drainState = { ...drainState, window: pushDrainSample(drainState.window, { atMs, energy: absoluteEnergyNow }) };
    }

    const fit = sampleSource === 'tap' ? fitDrainRate(drainState.window) : { trusted: false as const, reason: 'insufficientSamples' as const };

    let basis: CountdownBasis;
    let drainPerSecond: number;
    if (fit.trusted) {
      basis = 'observed';
      drainPerSecond = fit.ratePerSecond;
    } else {
      basis = 'modelled';
      const multipliers = modelledDrainMultipliers?.get(hero.id) ?? UNRESOLVED_DRAIN_MULTIPLIERS;
      drainPerSecond = combineDrainRate(multipliers.selfDrainMult, multipliers.teamDrainMult);

      if (fit.reason === 'rateOutOfRange' && !drainState.hasReportedRejection) {
        rejections.push({ heroId: hero.id, reason: 'rateOutOfRange' });
        drainState = { ...drainState, hasReportedRejection: true };
      }
    }
    heroDrainStates.set(hero.id, drainState);

    const latestKnownEnergy = absoluteEnergyNow ?? drainState.window.at(-1)?.energy ?? 0;
    const secondsRemaining = drainPerSecond > 0 ? Math.max(0, latestKnownEnergy / drainPerSecond) : 0;

    field.push({ heroId: hero.id, secondsRemaining, drainPerSecond, basis });
  }

  const recovery = computeRecovery(rotation);

  return {
    state: { onFieldHeroIds: newFieldIds, heroDrainStates, recovery },
    field,
    recovery,
    rejections,
  };
}

/**
 * Called when frames have stopped arriving. There is no wall-clock timer here: the world does
 * not advance while the client is not streaming, so recovery simply freezes on whatever value
 * the last frame computed, with `advancing` forced to `false`.
 */
export function freezeRecoveryCountdowns(state: FieldCountdownState): readonly RecoveryCountdown[] {
  return state.recovery.map((entry) => ({ ...entry, advancing: false }));
}
