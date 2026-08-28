import type {
  CountdownBasis,
  FieldCountdown,
  LiveCurrency,
  LiveEarnings,
  LiveGapReason,
  RecoveryCountdown,
  RotationHeroSnapshot,
  RotationNormalizeResult,
} from '@bombfarm/contracts';
import { classifyRotation, energyFractionOf } from '@bombfarm/domain/rotation-status';
import type { RecoveringHero, RotationHousePanel, RotationOccupancy, RotationStatus } from '@bombfarm/domain/rotation-status';

export interface LiveHeroFact {
  readonly id: string;
  readonly name?: string;
  readonly grade?: string;
  readonly level?: number;
  readonly rarity?: number;
  readonly stars?: number;
  readonly skin?: number;
  /** In [0, 1] — how full this hero's energy is. Absent when the snapshot carried no energy for
   *  it, which is what tells a full hero apart from one whose figure has not arrived. */
  readonly energyFraction?: number;
}

export interface LiveRecoveringHeroFact extends LiveHeroFact {
  readonly recoverySeconds?: number;
}

export interface LiveSlowModel {
  readonly onField: readonly LiveHeroFact[];
  readonly recovering: readonly LiveRecoveringHeroFact[];
  readonly queued: readonly LiveHeroFact[];
  readonly benched: readonly LiveHeroFact[];
  readonly unclassifiedCount: number;
  readonly fieldExitPendingCount: number;
  readonly occupancy: RotationOccupancy;
  readonly house: RotationHousePanel;
}

export interface LiveFieldCountdownModel {
  readonly heroId: string;
  readonly secondsRemaining: number;
  readonly basis: CountdownBasis;
}

export interface LiveRecoveryCountdownModel {
  readonly heroId: string;
  readonly secondsRemaining: number;
  readonly advancing: boolean;
}

export interface LiveFastModel {
  readonly field: Readonly<Record<string, LiveFieldCountdownModel>>;
  readonly recovery: Readonly<Record<string, LiveRecoveryCountdownModel>>;
}

export const EMPTY_LIVE_FAST_MODEL: LiveFastModel = { field: {}, recovery: {} };

export type LiveFreshness =
  | { readonly kind: 'bridge-unavailable' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'live' }
  | {
      readonly kind: 'gap';
      readonly reason: LiveGapReason;
      readonly actionable: boolean;
      readonly likelyQuarantine?: boolean;
    };

export const LOADING_LIVE_FRESHNESS: LiveFreshness = { kind: 'loading' };
export const BRIDGE_UNAVAILABLE_LIVE_FRESHNESS: LiveFreshness = { kind: 'bridge-unavailable' };

/**
 * Everything the Live screen renders. `slow` is `null` exactly when no rotation projection has
 * ever been read (the screen's own "no account data yet" empty state) — never an empty set of
 * lists standing in for that.
 */
export interface LiveModel {
  readonly freshness: LiveFreshness;
  readonly slow: LiveSlowModel | null;
  readonly fast: LiveFastModel;
  /** Straight from `LiveView`/`LiveEvent` — `null` exactly when the source says so, never a
   *  computed or defaulted stand-in. */
  readonly earnings: LiveEarnings | null;
}

export const INITIAL_LIVE_MODEL: LiveModel = {
  freshness: LOADING_LIVE_FRESHNESS,
  slow: null,
  fast: EMPTY_LIVE_FAST_MODEL,
  earnings: null,
};

function heroFact(hero: RotationHeroSnapshot): LiveHeroFact {
  const energyFraction = energyFractionOf(hero);
  return {
    id: hero.id,
    ...(hero.name !== undefined ? { name: hero.name } : {}),
    ...(hero.grade !== undefined ? { grade: hero.grade } : {}),
    ...(hero.level !== undefined ? { level: hero.level } : {}),
    ...(hero.rarity !== undefined ? { rarity: hero.rarity } : {}),
    ...(hero.stars !== undefined ? { stars: hero.stars } : {}),
    ...(hero.skin !== undefined ? { skin: hero.skin } : {}),
    ...(energyFraction !== undefined ? { energyFraction } : {}),
  };
}

function recoveringHeroFact(entry: RecoveringHero): LiveRecoveringHeroFact {
  return {
    ...heroFact(entry.hero),
    ...(entry.recoverySeconds !== undefined ? { recoverySeconds: entry.recoverySeconds } : {}),
  };
}

function buildLiveSlowModelFromStatus(status: RotationStatus): LiveSlowModel {
  return {
    onField: status.onField.map(heroFact),
    recovering: status.recovering.map(recoveringHeroFact),
    queued: status.queued.map(heroFact),
    benched: status.benched.map(heroFact),
    unclassifiedCount: status.unclassifiedCount,
    fieldExitPendingCount: status.fieldExitPendingCount,
    occupancy: status.occupancy,
    house: status.house,
  };
}

/** The renderer's one call site for {@link classifyRotation} — every list here is exactly what it
 *  returned, in the order it returned, re-shaped only to drop the fields the Live screen never
 *  reads (activity, energy, drops). `result.drops` is always `[]`: `LiveView.rotation` carries
 *  only the snapshot, and a dropped field is already visible as an absent optional one.
 *  `onFieldHeroIds` is the live tap's own on-field set (or its REST-derived stand-in); passing it
 *  through is what keeps on-field membership current within a frame rather than a whole slow
 *  cycle — see `classifyRotation`'s own doc comment for what it does with a departed hero. */
export function buildLiveSlowModel(
  result: RotationNormalizeResult,
  onFieldHeroIds?: readonly string[],
): LiveSlowModel {
  const liveOnField = onFieldHeroIds !== undefined ? new Set(onFieldHeroIds) : undefined;
  return buildLiveSlowModelFromStatus(classifyRotation(result, liveOnField));
}

export function buildLiveFreshness(currency: LiveCurrency): LiveFreshness {
  if (currency.kind === 'live') return { kind: 'live' };
  return {
    kind: 'gap',
    reason: currency.reason,
    actionable: currency.actionable,
    ...(currency.likelyQuarantine !== undefined ? { likelyQuarantine: currency.likelyQuarantine } : {}),
  };
}

export function buildLiveFastModel(
  field: readonly FieldCountdown[],
  recovery: readonly RecoveryCountdown[],
): LiveFastModel {
  const fieldByHero: Record<string, LiveFieldCountdownModel> = {};
  for (const entry of field) {
    fieldByHero[entry.heroId] = { heroId: entry.heroId, secondsRemaining: entry.secondsRemaining, basis: entry.basis };
  }
  const recoveryByHero: Record<string, LiveRecoveryCountdownModel> = {};
  for (const entry of recovery) {
    recoveryByHero[entry.heroId] = { heroId: entry.heroId, secondsRemaining: entry.secondsRemaining, advancing: entry.advancing };
  }
  return { field: fieldByHero, recovery: recoveryByHero };
}
