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
  drainRateDisagrees,
  EMPTY_HERO_DRAIN_OBSERVATION,
  observeDrainRate,
  type HeroDrainObservation,
} from './drain-checker';

export interface DrainMultipliers {
  readonly selfDrainMult: number;
  readonly teamDrainMult: number;
}

export interface DrainDisagreementReport {
  readonly heroId: string;
  readonly observedDrainPerSecond: number;
  readonly modelledDrainPerSecond: number;
}

interface HeroDrainState {
  readonly observation: HeroDrainObservation;
  readonly hasReportedDisagreement: boolean;
}

const EMPTY_HERO_DRAIN_STATE: HeroDrainState = {
  observation: EMPTY_HERO_DRAIN_OBSERVATION,
  hasReportedDisagreement: false,
};

/** Everything this module derives from `rotation` alone, cached against its reference identity —
 *  `rotation` changes on the slow authenticated cycle while a frame arrives ~10x/second, so
 *  rebuilding either the hero-lookup map or the recovery-at-read list on every tick redoes the
 *  same work roughly 600 times per real change. */
interface RotationCache {
  readonly rotation: RotationSnapshot | null;
  readonly heroSnapshotById: ReadonlyMap<string, RotationHeroSnapshot>;
  /** Recovery as the rotation read itself reported it, with no elapsed-time adjustment yet — see
   *  {@link advanceRecoveryClock}, which is where that adjustment happens. */
  readonly recoveryAtRead: readonly RecoveryCountdown[];
  readonly recoveryReadAtMs: number;
}

export interface FieldCountdownState {
  readonly onFieldHeroIds: ReadonlySet<string>;
  /** `[...onFieldHeroIds].sort()`, held here so a caller polling every tick (the fast publisher,
   *  four times a second) reads it rather than re-deriving it — rebuilt only on the tick below
   *  where membership actually changes, never on every tick regardless. */
  readonly onFieldHeroIdsSorted: readonly string[];
  readonly heroDrainStates: ReadonlyMap<string, HeroDrainState>;
  readonly rotationCache: RotationCache | null;
  /** The latest instant {@link advanceRecoveryClock} has been allowed to advance recovery to —
   *  see its own doc comment for what pins and moves this. */
  readonly recoveryAnchorMs: number | undefined;
}

export function createInitialFieldCountdownState(): FieldCountdownState {
  return {
    onFieldHeroIds: new Set(),
    onFieldHeroIdsSorted: [],
    heroDrainStates: new Map(),
    rotationCache: null,
    recoveryAnchorMs: undefined,
  };
}

function computeRecoveryAtRead(rotation: RotationSnapshot | null): readonly RecoveryCountdown[] {
  const cycleSeconds = rotation?.house?.cycleSeconds;
  if (rotation === null || cycleSeconds === undefined) return [];

  const recovery: RecoveryCountdown[] = [];
  for (const hero of rotation.heroes) {
    if (hero.activity !== 'resting' || hero.recovering !== true) continue;
    const recoverySeconds = recoverySecondsFor(hero, cycleSeconds);
    if (recoverySeconds === undefined) continue;
    recovery.push({ heroId: hero.id, secondsRemaining: Math.max(0, recoverySeconds), advancing: true });
  }
  return recovery;
}

function deriveRotationCache(rotation: RotationSnapshot | null, atMs: number): RotationCache {
  const heroSnapshotById = new Map<string, RotationHeroSnapshot>();
  for (const hero of rotation?.heroes ?? []) heroSnapshotById.set(hero.id, hero);
  return { rotation, heroSnapshotById, recoveryAtRead: computeRecoveryAtRead(rotation), recoveryReadAtMs: atMs };
}

export interface FieldCountdownInput {
  readonly tick: LiveTick;
  readonly rotation: RotationSnapshot | null;
  readonly atMs: number;
  readonly modelledDrainMultipliers?: ReadonlyMap<string, DrainMultipliers>;
  /** `'tap'` (the default) is a genuine live-stream frame and may feed the background checker.
   *  `'rest'` is an authenticated-refresh reading standing in for one: real energy values, but at
   *  ~60s spacing rather than the tap's own cadence, so it never advances the checker's own
   *  two-point observation — a gap that wide could straddle a recharge the checker would never see. */
  readonly sampleSource?: 'tap' | 'rest';
}

export interface FieldCountdownResult {
  readonly state: FieldCountdownState;
  readonly field: readonly FieldCountdown[];
  readonly disagreements: readonly DrainDisagreementReport[];
}

function sameMembership(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

/**
 * Assembles the live view's field countdowns from one frame, driven by the drain law
 * (`combineDrainRate`) rather than a measured rate: `secondsRemaining = energy / drainPerSecond`
 * is exact on the very first reading and needs no warm-up. A hero with no resolvable roster
 * multipliers gets no entry at all — an absent countdown beats a wrong one.
 *
 * Alongside the displayed number, each tap frame also feeds a background check: the same energy
 * series gives an independently observed rate, compared against the law and reported in
 * `disagreements` when the two disagree by more than {@link drainRateDisagrees}'s margin. That
 * check never feeds `secondsRemaining` — it exists to catch the law itself being wrong, which a
 * number derived from the law never could.
 */
export function ingestFieldCountdownTick(
  state: FieldCountdownState,
  input: FieldCountdownInput,
): FieldCountdownResult {
  const { tick, rotation, atMs, modelledDrainMultipliers, sampleSource = 'tap' } = input;

  const rotationCache =
    state.rotationCache && state.rotationCache.rotation === rotation
      ? state.rotationCache
      : deriveRotationCache(rotation, atMs);
  const heroSnapshotById = rotationCache.heroSnapshotById;

  const newFieldIds = new Set(tick.heroes.map((hero) => hero.id));
  const membershipChanged = !sameMembership(newFieldIds, state.onFieldHeroIds);
  const onFieldHeroIdsSorted = membershipChanged ? [...newFieldIds].sort() : state.onFieldHeroIdsSorted;

  const heroDrainStates = new Map<string, HeroDrainState>();
  for (const [heroId, drainState] of state.heroDrainStates) {
    if (!newFieldIds.has(heroId)) continue; // departed: discard, start clean on return
    heroDrainStates.set(heroId, drainState);
  }

  const disagreements: DrainDisagreementReport[] = [];
  const field: FieldCountdown[] = [];

  for (const hero of tick.heroes) {
    const heroSnapshot = heroSnapshotById.get(hero.id);
    const energyMax = heroSnapshot?.energyMax;
    const absoluteEnergyNow =
      hero.energyFraction !== undefined && energyMax !== undefined && energyMax > 0
        ? hero.energyFraction * energyMax
        : undefined;

    let drainState = heroDrainStates.get(hero.id) ?? EMPTY_HERO_DRAIN_STATE;
    const resolvedMultipliers = modelledDrainMultipliers?.get(hero.id);

    if (resolvedMultipliers !== undefined && absoluteEnergyNow !== undefined) {
      const modelledDrainPerSecond = combineDrainRate(resolvedMultipliers.selfDrainMult, resolvedMultipliers.teamDrainMult);
      field.push({
        heroId: hero.id,
        secondsRemaining: absoluteEnergyNow / modelledDrainPerSecond,
        drainPerSecond: modelledDrainPerSecond,
        basis: 'modelled',
      });

      if (sampleSource === 'tap') {
        const observation = observeDrainRate(drainState.observation, absoluteEnergyNow, atMs);
        drainState = { ...drainState, observation: observation.state };
        const { observedDrainPerSecond } = observation;
        if (observedDrainPerSecond !== undefined && drainRateDisagrees(observedDrainPerSecond, modelledDrainPerSecond)) {
          if (!drainState.hasReportedDisagreement) {
            disagreements.push({ heroId: hero.id, observedDrainPerSecond, modelledDrainPerSecond });
          }
          drainState = { ...drainState, hasReportedDisagreement: true };
        }
      }
    } else if (sampleSource === 'tap' && absoluteEnergyNow !== undefined) {
      drainState = { ...drainState, observation: observeDrainRate(drainState.observation, absoluteEnergyNow, atMs).state };
    }

    heroDrainStates.set(hero.id, drainState);
  }

  return {
    state: { onFieldHeroIds: newFieldIds, onFieldHeroIdsSorted, heroDrainStates, rotationCache, recoveryAnchorMs: state.recoveryAnchorMs },
    field,
    disagreements,
  };
}

export interface AdvanceRecoveryClockResult {
  readonly state: FieldCountdownState;
  readonly recovery: readonly RecoveryCountdown[];
}

/** A read at least as recent as the pinned anchor keeps the anchor pinned (still frozen); an
 *  actually fresher read overrides it, since fresher information beats extrapolation. */
function pinnedAnchorMs(readAtMs: number, priorAnchorMs: number | undefined): number {
  return priorAnchorMs !== undefined && priorAnchorMs >= readAtMs ? priorAnchorMs : readAtMs;
}

/**
 * Recovery runs on the server's own clock regardless of whether combat frames are streaming, so
 * `connected` — not frame arrival — decides whether it may advance. While connected, the anchor
 * tracks the current instant, so the gap between it and the read grows in real time. A fresher
 * read (even one that arrives while disconnected) becomes the new anchor outright, since it is
 * simply better information than anything extrapolated from the old one. Otherwise, once
 * disconnected the anchor stops moving, so every later call reports exactly the figure it did the
 * instant connection was lost — never advancing through unconfirmed time, never leaping back to
 * the stale read either.
 */
export function advanceRecoveryClock(state: FieldCountdownState, nowMs: number, connected: boolean): AdvanceRecoveryClockResult {
  const cache = state.rotationCache;
  if (cache === null) return { state, recovery: [] };

  const readAtMs = cache.recoveryReadAtMs;
  const priorAnchorMs = state.recoveryAnchorMs;
  const anchorMs = connected ? Math.max(nowMs, readAtMs) : pinnedAnchorMs(readAtMs, priorAnchorMs);

  const elapsedSeconds = Math.max(0, (anchorMs - readAtMs) / 1000);
  const recovery = cache.recoveryAtRead.map((entry) => ({
    heroId: entry.heroId,
    secondsRemaining: Math.max(0, entry.secondsRemaining - elapsedSeconds),
    advancing: connected,
  }));

  const nextState = anchorMs === priorAnchorMs ? state : { ...state, recoveryAnchorMs: anchorMs };
  return { state: nextState, recovery };
}
