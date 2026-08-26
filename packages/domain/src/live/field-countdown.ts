import type {
  FieldCountdown,
  LiveTick,
  RecoveryCountdown,
  RotationHeroSnapshot,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { combineDrainRate } from '../drain';
import { recoverySecondsFor } from '../rotation-status';
import {
  advanceFrameClock,
  advanceHeroEnergyClock,
  EMPTY_HERO_ENERGY_CLOCK,
  INITIAL_FRAME_CLOCK_STATE,
  MAX_TRUSTED_DRAIN_RATE,
  measuredSecondsPerFrame,
  MIN_TRUSTED_DRAIN_RATE,
  type FrameClockState,
  type HeroEnergyClockState,
} from './drain-slope';

export interface DrainMultipliers {
  readonly selfDrainMult: number;
  readonly teamDrainMult: number;
}

export interface DrainRejectionReport {
  readonly heroId: string;
  readonly reason: 'rateOutOfRange';
}

interface HeroDrainState {
  readonly energyClock: HeroEnergyClockState;
  /** Updated from any sample source, tap or rest — unlike {@link HeroEnergyClockState.lastEnergy},
   *  which only a tap frame advances. This is what the never-rise clamp below compares against. */
  readonly lastEnergy: number | undefined;
  readonly lastSecondsRemaining: number | undefined;
  readonly hasReportedRejection: boolean;
}

const EMPTY_HERO_DRAIN_STATE: HeroDrainState = {
  energyClock: EMPTY_HERO_ENERGY_CLOCK,
  lastEnergy: undefined,
  lastSecondsRemaining: undefined,
  hasReportedRejection: false,
};

/** Everything this module derives from `rotation` alone, cached against its reference identity —
 *  `rotation` changes on the slow authenticated cycle while a frame arrives ~10x/second, so
 *  rebuilding either the hero-lookup map or the recovery list on every tick redoes the same work
 *  roughly 600 times per real change. */
interface RotationCache {
  readonly rotation: RotationSnapshot | null;
  readonly heroSnapshotById: ReadonlyMap<string, RotationHeroSnapshot>;
  readonly recovery: readonly RecoveryCountdown[];
}

export interface FieldCountdownState {
  readonly onFieldHeroIds: ReadonlySet<string>;
  /** `[...onFieldHeroIds].sort()`, held here so a caller polling every tick (the fast publisher,
   *  four times a second) reads it rather than re-deriving it — rebuilt only on the tick below
   *  where membership actually changes, never on every tick regardless. */
  readonly onFieldHeroIdsSorted: readonly string[];
  readonly heroDrainStates: ReadonlyMap<string, HeroDrainState>;
  /** One clock, shared by every hero — see {@link advanceFrameClock}. */
  readonly frameClock: FrameClockState;
  readonly recovery: readonly RecoveryCountdown[];
  readonly rotationCache: RotationCache | null;
}

export function createInitialFieldCountdownState(): FieldCountdownState {
  return {
    onFieldHeroIds: new Set(),
    onFieldHeroIdsSorted: [],
    heroDrainStates: new Map(),
    frameClock: INITIAL_FRAME_CLOCK_STATE,
    recovery: [],
    rotationCache: null,
  };
}

function deriveRotationCache(rotation: RotationSnapshot | null): RotationCache {
  const heroSnapshotById = new Map<string, RotationHeroSnapshot>();
  for (const hero of rotation?.heroes ?? []) heroSnapshotById.set(hero.id, hero);
  return { rotation, heroSnapshotById, recovery: computeRecovery(rotation) };
}

export interface FieldCountdownInput {
  readonly tick: LiveTick;
  readonly rotation: RotationSnapshot | null;
  readonly atMs: number;
  readonly modelledDrainMultipliers?: ReadonlyMap<string, DrainMultipliers>;
  /** `'tap'` (the default) is a genuine live-stream frame and may feed the observed clock.
   *  `'rest'` is an authenticated-refresh reading standing in for one: real energy values, but at
   *  ~60s spacing rather than the tap's own cadence, so it must never earn an `observed` basis and
   *  never advances either clock. */
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

function secondsRemainingFor(drainPerSecond: number, latestKnownEnergy: number): number {
  return drainPerSecond > 0 ? Math.max(0, latestKnownEnergy / drainPerSecond) : 0;
}

/**
 * Assembles the live view's field and recovery countdowns from one frame. A hero's basis is
 * `'observed'` only when both its own energy-drop-per-frame and the shared frame clock are
 * measured; a hero whose fit is untrusted and whose multipliers cannot be resolved gets no entry
 * at all — an absent countdown beats a wrong one.
 */
export function ingestFieldCountdownTick(
  state: FieldCountdownState,
  input: FieldCountdownInput,
): FieldCountdownResult {
  const { tick, rotation, atMs, modelledDrainMultipliers, sampleSource = 'tap' } = input;

  const rotationCache =
    state.rotationCache && state.rotationCache.rotation === rotation
      ? state.rotationCache
      : deriveRotationCache(rotation);
  const heroSnapshotById = rotationCache.heroSnapshotById;

  const newFieldIds = new Set(tick.heroes.map((hero) => hero.id));
  const membershipChanged = !sameMembership(newFieldIds, state.onFieldHeroIds);
  const onFieldHeroIdsSorted = membershipChanged ? [...newFieldIds].sort() : state.onFieldHeroIdsSorted;

  const heroDrainStates = new Map<string, HeroDrainState>();
  for (const [heroId, drainState] of state.heroDrainStates) {
    if (!newFieldIds.has(heroId)) continue; // departed: discard, start clean on return
    heroDrainStates.set(heroId, drainState);
  }

  const frameClock = sampleSource === 'tap' ? advanceFrameClock(state.frameClock, atMs) : state.frameClock;
  const secondsPerFrame = measuredSecondsPerFrame(frameClock);

  const rejections: DrainRejectionReport[] = [];
  const field: FieldCountdown[] = [];

  for (const hero of tick.heroes) {
    const heroSnapshot = heroSnapshotById.get(hero.id);
    const energyMax = heroSnapshot?.energyMax;
    const absoluteEnergyNow =
      hero.energyFraction !== undefined && energyMax !== undefined && energyMax > 0
        ? hero.energyFraction * energyMax
        : undefined;

    const resolvedMultipliers = modelledDrainMultipliers?.get(hero.id);
    let drainState = heroDrainStates.get(hero.id) ?? EMPTY_HERO_DRAIN_STATE;

    const previousEnergy = drainState.lastEnergy;
    const energyRose = absoluteEnergyNow !== undefined && previousEnergy !== undefined && absoluteEnergyNow > previousEnergy;

    let deltaPerFrame = drainState.energyClock.deltaPerFrame;
    if (absoluteEnergyNow !== undefined && sampleSource === 'tap') {
      const energyClock = advanceHeroEnergyClock(drainState.energyClock, absoluteEnergyNow);
      drainState = { ...drainState, energyClock };
      deltaPerFrame = energyClock.deltaPerFrame;
    }

    const observedDrainPerSecond =
      sampleSource === 'tap' && deltaPerFrame !== undefined && secondsPerFrame !== undefined
        ? deltaPerFrame / secondsPerFrame
        : undefined;
    const rateOutOfRange =
      observedDrainPerSecond !== undefined &&
      (observedDrainPerSecond < MIN_TRUSTED_DRAIN_RATE || observedDrainPerSecond > MAX_TRUSTED_DRAIN_RATE);

    if (rateOutOfRange && !drainState.hasReportedRejection) {
      rejections.push({ heroId: hero.id, reason: 'rateOutOfRange' });
      drainState = { ...drainState, hasReportedRejection: true };
    }

    const latestKnownEnergy = absoluteEnergyNow ?? drainState.lastEnergy ?? 0;
    let entry: FieldCountdown | undefined;
    if (observedDrainPerSecond !== undefined && !rateOutOfRange) {
      const framesRemaining = latestKnownEnergy / deltaPerFrame!;
      entry = {
        heroId: hero.id,
        secondsRemaining: Math.max(0, framesRemaining * secondsPerFrame!),
        drainPerSecond: observedDrainPerSecond,
        basis: 'observed',
      };
    } else if (resolvedMultipliers !== undefined) {
      const drainPerSecond = combineDrainRate(resolvedMultipliers.selfDrainMult, resolvedMultipliers.teamDrainMult);
      entry = {
        heroId: hero.id,
        secondsRemaining: secondsRemainingFor(drainPerSecond, latestKnownEnergy),
        drainPerSecond,
        basis: 'modelled',
      };
    }

    // A hero's true rate can genuinely fall (a buff expiring, say), which would otherwise raise
    // the displayed remaining time even though nothing about the hero's own energy changed. This
    // clamp holds the number flat instead — under-reporting until the truth catches down to it —
    // trading exactness for a countdown that never visibly ticks backward. An exact per-frame
    // delta makes the countdown monotone by construction, so in normal operation this clamp
    // should never bind; it stays as a cheap backstop for the modelled fallback path.
    if (entry !== undefined) {
      const secondsRemaining =
        !energyRose && drainState.lastSecondsRemaining !== undefined
          ? Math.min(entry.secondsRemaining, drainState.lastSecondsRemaining)
          : entry.secondsRemaining;
      entry = { ...entry, secondsRemaining };
      drainState = { ...drainState, lastSecondsRemaining: secondsRemaining };
    }
    if (absoluteEnergyNow !== undefined) {
      drainState = { ...drainState, lastEnergy: absoluteEnergyNow };
    }

    heroDrainStates.set(hero.id, drainState);
    if (entry !== undefined) field.push(entry);
  }

  const recovery = rotationCache.recovery;

  return {
    state: { onFieldHeroIds: newFieldIds, onFieldHeroIdsSorted, heroDrainStates, frameClock, recovery, rotationCache },
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
