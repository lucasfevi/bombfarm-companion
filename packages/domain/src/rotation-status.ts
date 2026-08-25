import type { FieldDrop, RotationHeroSnapshot, RotationNormalizeResult } from '@bombfarm/contracts';

export interface RecoveringHero {
  readonly hero: RotationHeroSnapshot;
  readonly recoverySeconds?: number;
}

export interface RotationOccupancy {
  readonly occupied: number;
  readonly fieldSize?: number;
}

export interface RotationHousePanel {
  readonly activeHouseIndex?: number;
  readonly activeHouseLevel?: number;
  readonly slots?: number;
  readonly cycleSeconds?: number;
  readonly rescuesLeft?: number;
  readonly rescuesMax?: number;
}

export interface RotationStatus {
  readonly onField: readonly RotationHeroSnapshot[];
  readonly recovering: readonly RecoveringHero[];
  readonly queued: readonly RotationHeroSnapshot[];
  readonly benched: readonly RotationHeroSnapshot[];
  /** A hero the normalizer genuinely could not classify — an unrecognized or missing `activity`.
   *  Never a hero whose only problem is that the live tap and the snapshot disagree; that is
   *  {@link fieldExitPendingCount}, a routine condition, not this one. */
  readonly unclassifiedCount: number;
  /** A hero `snapshot` still calls `inField` that the live tap's on-field set no longer names —
   *  it has left, its destination is not yet known, and the next frame or slow refresh resolves it
   *  within seconds. Routine and self-resolving, so it is counted separately from
   *  {@link unclassifiedCount} rather than folded into a counter meant for unusable data. */
  readonly fieldExitPendingCount: number;
  readonly occupancy: RotationOccupancy;
  readonly house: RotationHousePanel;
  readonly drops: readonly FieldDrop[];
}

/** A hero's energy can exceed its own ceiling, so the fraction derived from the pair is capped
 *  the same way the normalizer caps the wire's own out-of-range fraction. Uncapped, a hero at
 *  120/100 would be given a negative remaining recovery. */
export function energyFractionOf(hero: RotationHeroSnapshot): number | undefined {
  if (hero.energyFraction !== undefined) return hero.energyFraction;
  if (hero.energy !== undefined && hero.energyMax !== undefined && hero.energyMax > 0) {
    return Math.min(hero.energy / hero.energyMax, 1);
  }
  return undefined;
}

function compareIds(a: RotationHeroSnapshot, b: RotationHeroSnapshot): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Heroes with no energy figure sort after every hero that has one, in either direction, so
 *  ordering stays deterministic without inventing a fraction for them. */
function byEnergyFraction(direction: 'ascending' | 'descending') {
  return (a: RotationHeroSnapshot, b: RotationHeroSnapshot): number => {
    const fractionA = energyFractionOf(a);
    const fractionB = energyFractionOf(b);
    if (fractionA === undefined && fractionB === undefined) return compareIds(a, b);
    if (fractionA === undefined) return 1;
    if (fractionB === undefined) return -1;
    const diff = direction === 'ascending' ? fractionA - fractionB : fractionB - fractionA;
    return diff !== 0 ? diff : compareIds(a, b);
  };
}

export function recoverySecondsFor(hero: RotationHeroSnapshot, cycleSeconds: number | undefined): number | undefined {
  if (cycleSeconds === undefined) return undefined;
  const fraction = energyFractionOf(hero);
  if (fraction === undefined) return undefined;
  return (1 - fraction) * cycleSeconds;
}

function buildHousePanel(snapshot: RotationNormalizeResult['snapshot']): RotationHousePanel {
  const house = snapshot.house;
  const activeHouseIndex = house?.activeHouseIndex;
  const houseLevels = house?.houseLevels;
  const identityKnown =
    activeHouseIndex !== undefined &&
    houseLevels !== undefined &&
    activeHouseIndex >= 0 &&
    activeHouseIndex < houseLevels.length;

  return {
    ...(identityKnown ? { activeHouseIndex, activeHouseLevel: houseLevels[activeHouseIndex] } : {}),
    ...(house?.slots !== undefined ? { slots: house.slots } : {}),
    ...(house?.cycleSeconds !== undefined ? { cycleSeconds: house.cycleSeconds } : {}),
    ...(snapshot.rescuesLeft !== undefined ? { rescuesLeft: snapshot.rescuesLeft } : {}),
    ...(snapshot.rescuesMax !== undefined ? { rescuesMax: snapshot.rescuesMax } : {}),
  };
}

/**
 * Sorts the normalized `/rotation` snapshot's heroes into panel-ready lists. Classification keys
 * off `activity` alone, never `inHouse` — a hero benched at the house still carries `inHouse:
 * true`, so that field cannot distinguish "benched" from "queued to recover".
 *
 * `liveOnField`, when given, is the live tap's own on-field id set and overrules `activity` for
 * field membership: a hero it names is on the field even if `snapshot` disagrees, and a hero
 * `snapshot` still calls `inField` that it does NOT name has left — and where it went is not yet
 * known, so it is withheld from every list (counted in `fieldExitPendingCount`, never
 * `unclassifiedCount`) rather than guessed into one. A hero `liveOnField` names that `snapshot`
 * has never carried at all — acquired or first deployed since the last slow read — is added to
 * `onField` with nothing but its id, rather than dropped: every hero the frames show on the field
 * is on the field and counted, whether or not the snapshot has caught up to it yet. Omit
 * `liveOnField` entirely to classify on `snapshot` alone, unchanged from before this parameter
 * existed.
 */
export function classifyRotation(
  result: RotationNormalizeResult,
  liveOnField?: ReadonlySet<string>,
): RotationStatus {
  const { snapshot } = result;
  const cycleSeconds = snapshot.house?.cycleSeconds;

  const onField: RotationHeroSnapshot[] = [];
  const recovering: RecoveringHero[] = [];
  const queuedResting: RotationHeroSnapshot[] = [];
  const queuedReady: RotationHeroSnapshot[] = [];
  const benched: RotationHeroSnapshot[] = [];
  let unclassifiedCount = 0;
  let fieldExitPendingCount = 0;
  const liveIdsMatchedToSnapshot = new Set<string>();

  snapshot.heroes.forEach((hero) => {
    if (liveOnField !== undefined && liveOnField.has(hero.id)) {
      liveIdsMatchedToSnapshot.add(hero.id);
      onField.push(hero);
      return;
    }
    if (liveOnField !== undefined && hero.activity === 'inField') {
      fieldExitPendingCount += 1;
      return;
    }
    switch (hero.activity) {
      case 'inField':
        onField.push(hero);
        break;
      case 'resting':
        // A resting hero not flagged `recovering` has no clock running on it — it is queued,
        // waiting for a house slot, not counting down toward one.
        if (hero.recovering === true) {
          const recoverySeconds = recoverySecondsFor(hero, cycleSeconds);
          recovering.push({ hero, ...(recoverySeconds !== undefined ? { recoverySeconds } : {}) });
        } else {
          queuedResting.push(hero);
        }
        break;
      case 'ready':
        queuedReady.push(hero);
        break;
      case 'benched':
        benched.push(hero);
        break;
      default: {
        // Narrows to `undefined` only while every declared activity has a case above, so adding
        // one to the vocabulary fails to compile here rather than silently going unclassified.
        const unhandled: undefined = hero.activity;
        void unhandled;
        // The loss is not re-reported: the normalizer already emitted one drop naming the wire
        // field and the real reason, and this layer can no longer tell `missing` from
        // `out_of_range`, nor address a hero by its position in a list it has already filtered.
        unclassifiedCount += 1;
      }
    }
  });

  if (liveOnField !== undefined) {
    for (const id of liveOnField) {
      if (!liveIdsMatchedToSnapshot.has(id)) onField.push({ id });
    }
  }

  const byEmptiestFirst = byEnergyFraction('ascending');
  const byFullestFirst = byEnergyFraction('descending');

  onField.sort(byEmptiestFirst);
  recovering.sort((a, b) => byFullestFirst(a.hero, b.hero));
  queuedResting.sort(byFullestFirst);
  queuedReady.sort(byFullestFirst);
  benched.sort(compareIds);

  return {
    onField,
    recovering,
    queued: [...queuedResting, ...queuedReady],
    benched,
    unclassifiedCount,
    fieldExitPendingCount,
    occupancy: {
      occupied: onField.length,
      ...(snapshot.fieldSize !== undefined ? { fieldSize: snapshot.fieldSize } : {}),
    },
    house: buildHousePanel(snapshot),
    drops: result.drops,
  };
}
