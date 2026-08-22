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
  readonly unclassifiedCount: number;
  readonly occupancy: RotationOccupancy;
  readonly house: RotationHousePanel;
  readonly drops: readonly FieldDrop[];
}

/** A hero's energy can exceed its own ceiling, so the fraction derived from the pair is capped
 *  the same way the normalizer caps the wire's own out-of-range fraction. Uncapped, a hero at
 *  120/100 would be given a negative remaining recovery. */
function energyFractionOf(hero: RotationHeroSnapshot): number | undefined {
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

function recoverySecondsFor(hero: RotationHeroSnapshot, cycleSeconds: number | undefined): number | undefined {
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
 */
export function classifyRotation(result: RotationNormalizeResult): RotationStatus {
  const { snapshot } = result;
  const cycleSeconds = snapshot.house?.cycleSeconds;

  const onField: RotationHeroSnapshot[] = [];
  const recovering: RecoveringHero[] = [];
  const queuedResting: RotationHeroSnapshot[] = [];
  const queuedReady: RotationHeroSnapshot[] = [];
  const benched: RotationHeroSnapshot[] = [];
  let unclassifiedCount = 0;

  snapshot.heroes.forEach((hero) => {
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
    occupancy: {
      occupied: onField.length,
      ...(snapshot.fieldSize !== undefined ? { fieldSize: snapshot.fieldSize } : {}),
    },
    house: buildHousePanel(snapshot),
    drops: result.drops,
  };
}
