import type {
  FieldCountdown,
  LiveTick,
  RecoveryCountdown,
  RotationHeroSnapshot,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { combineDrainRate } from '../drain';
import { recoverySecondsFor } from '../rotation-status';
import { fitDrainRate, pushDrainSample, MIN_TRUSTED_SPAN_MS, type DrainSample } from './drain-slope';

export interface DrainMultipliers {
  readonly selfDrainMult: number;
  readonly teamDrainMult: number;
}

export interface DrainRejectionReport {
  readonly heroId: string;
  readonly reason: 'rateOutOfRange';
}

/** How long a rate eases from the last trusted measurement to the new modelled estimate after a
 *  composition change. Matches {@link MIN_TRUSTED_SPAN_MS} — the fit needs that long to earn
 *  trust again after its window is cleared, so the blend lands on the modelled estimate right as
 *  a fresh observed rate would otherwise take over, instead of holding the old slope any longer
 *  than the fit itself would have. */
const RATE_BLEND_DURATION_MS = MIN_TRUSTED_SPAN_MS;

interface RateBlend {
  readonly fromRate: number;
  readonly toRate: number;
  readonly startAtMs: number;
}

interface HeroDrainState {
  readonly window: readonly DrainSample[];
  readonly hasReportedRejection: boolean;
  /** The resolved multipliers this hero's window was last fitted under — `undefined` when the
   *  caller could not resolve any. Compared, not merely stored: {@link ingestFieldCountdownTick}
   *  discards the window the tick this changes value, since that is the one thing that actually
   *  invalidates a fitted slope. */
  readonly resolvedMultipliers: DrainMultipliers | undefined;
  /** The most recently displayed rate, trusted or blended — the anchor a new blend eases from,
   *  so a second composition change before the first blend finishes never snaps back past it. */
  readonly lastRate: number | undefined;
  /** Set when this hero's own multipliers change while a rate is carried; cleared once a fresh
   *  fit earns trust again. */
  readonly rateBlend: RateBlend | undefined;
  readonly lastEnergy: number | undefined;
  readonly lastSecondsRemaining: number | undefined;
}

const EMPTY_HERO_DRAIN_STATE: HeroDrainState = {
  window: [],
  hasReportedRejection: false,
  resolvedMultipliers: undefined,
  lastRate: undefined,
  rateBlend: undefined,
  lastEnergy: undefined,
  lastSecondsRemaining: undefined,
};

function sameMultipliers(a: DrainMultipliers | undefined, b: DrainMultipliers | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.selfDrainMult === b.selfDrainMult && a.teamDrainMult === b.teamDrainMult;
}

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
  readonly recovery: readonly RecoveryCountdown[];
  readonly rotationCache: RotationCache | null;
}

export function createInitialFieldCountdownState(): FieldCountdownState {
  return { onFieldHeroIds: new Set(), onFieldHeroIdsSorted: [], heroDrainStates: new Map(), recovery: [], rotationCache: null };
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

function secondsRemainingFor(drainPerSecond: number, latestKnownEnergy: number): number {
  return drainPerSecond > 0 ? Math.max(0, latestKnownEnergy / drainPerSecond) : 0;
}

/**
 * Assembles the live view's field and recovery countdowns from one frame. A hero's basis is
 * `'observed'` only when its rolling window carries a trusted fit; a hero's window is discarded
 * only when ITS OWN resolved drain multipliers change value tick to tick, never merely because
 * some other hero joined or left the field. A hero whose fit is untrusted and whose multipliers
 * cannot be resolved gets no entry at all — an absent countdown beats a wrong one.
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
    if (!sameMultipliers(resolvedMultipliers, drainState.resolvedMultipliers)) {
      const rateBlend: RateBlend | undefined =
        drainState.lastRate !== undefined && resolvedMultipliers !== undefined
          ? {
              fromRate: drainState.lastRate,
              toRate: combineDrainRate(resolvedMultipliers.selfDrainMult, resolvedMultipliers.teamDrainMult),
              startAtMs: atMs,
            }
          : undefined;
      drainState = { ...drainState, window: [], resolvedMultipliers, rateBlend };
    }
    if (absoluteEnergyNow !== undefined && sampleSource === 'tap') {
      drainState = { ...drainState, window: pushDrainSample(drainState.window, { atMs, energy: absoluteEnergyNow }) };
    }

    const fit = sampleSource === 'tap' ? fitDrainRate(drainState.window) : { trusted: false as const, reason: 'insufficientSamples' as const };

    if (!fit.trusted && fit.reason === 'rateOutOfRange' && !drainState.hasReportedRejection) {
      rejections.push({ heroId: hero.id, reason: 'rateOutOfRange' });
      drainState = { ...drainState, hasReportedRejection: true };
    }

    const latestKnownEnergy = absoluteEnergyNow ?? drainState.window.at(-1)?.energy ?? 0;
    let entry: FieldCountdown | undefined;
    if (fit.trusted) {
      const latestSampleAtMs = drainState.window.at(-1)!.atMs;
      const secondsRemaining = Math.max(0, (fit.zeroAtMs - latestSampleAtMs) / 1000);
      entry = { heroId: hero.id, secondsRemaining, drainPerSecond: fit.ratePerSecond, basis: 'observed' };
      drainState = { ...drainState, lastRate: fit.ratePerSecond, rateBlend: undefined };
    } else if (drainState.rateBlend !== undefined) {
      const { fromRate, toRate, startAtMs } = drainState.rateBlend;
      const progress = Math.min(1, Math.max(0, (atMs - startAtMs) / RATE_BLEND_DURATION_MS));
      const drainPerSecond = fromRate + (toRate - fromRate) * progress;
      entry = { heroId: hero.id, secondsRemaining: secondsRemainingFor(drainPerSecond, latestKnownEnergy), drainPerSecond, basis: 'modelled' };
      drainState = { ...drainState, lastRate: drainPerSecond };
    } else if (resolvedMultipliers !== undefined) {
      const drainPerSecond = combineDrainRate(resolvedMultipliers.selfDrainMult, resolvedMultipliers.teamDrainMult);
      entry = { heroId: hero.id, secondsRemaining: secondsRemainingFor(drainPerSecond, latestKnownEnergy), drainPerSecond, basis: 'modelled' };
      drainState = { ...drainState, lastRate: drainPerSecond };
    }

    // A hero's true rate can genuinely fall (a buff expiring, say), which would otherwise raise
    // the displayed remaining time even though nothing about the hero's own energy changed. This
    // clamp holds the number flat instead — under-reporting until the truth catches down to it —
    // trading exactness for a countdown that never visibly ticks backward.
    if (entry !== undefined) {
      const previousEnergy = drainState.lastEnergy;
      const energyRose = absoluteEnergyNow !== undefined && previousEnergy !== undefined && absoluteEnergyNow > previousEnergy;
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
    state: { onFieldHeroIds: newFieldIds, onFieldHeroIdsSorted, heroDrainStates, recovery, rotationCache },
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
