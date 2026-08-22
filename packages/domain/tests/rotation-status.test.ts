import { describe, expect, it } from 'vitest';
import type {
  FieldDrop,
  HouseSnapshot,
  RotationHeroSnapshot,
  RotationNormalizeResult,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { classifyRotation, type RotationStatus } from '@bombfarm/domain/rotation-status';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const CYCLE_SECONDS = 1190.5263157894735;

function loadFixture(): RotationNormalizeResult {
  return loadFixtureJson('rotation-snapshot.json', 'api') as unknown as RotationNormalizeResult;
}

function heroIds(heroes: readonly RotationHeroSnapshot[]): string[] {
  return heroes.map((hero) => hero.id);
}

function snapshotResult(overrides: Partial<RotationSnapshot>, drops: FieldDrop[] = []): RotationNormalizeResult {
  return { snapshot: { heroes: [], ...overrides }, drops };
}

function totalClassified(status: RotationStatus): number {
  return (
    status.onField.length +
    status.recovering.length +
    status.queued.length +
    status.benched.length +
    status.unclassifiedCount
  );
}

const FORBIDDEN_KEY = /warn|severity|flag|alert|deficien|shortfall|insufficient/i;

function assertNoJudgementKeys(value: unknown, seen = new Set<unknown>()): void {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertNoJudgementKeys(item, seen);
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    expect(FORBIDDEN_KEY.test(key)).toBe(false);
    assertNoJudgementKeys(nested, seen);
  }
}

describe('classifyRotation — fixture baseline', () => {
  const fixture = loadFixture();
  const status = classifyRotation(fixture);

  function withHouse(house: HouseSnapshot | undefined): RotationNormalizeResult {
    return { ...fixture, snapshot: { ...fixture.snapshot, house } };
  }

  it('classifies 1 onField, 3 recovering, 1 queued, 3 benched, 0 unclassified', () => {
    expect(status.onField).toHaveLength(1);
    expect(status.recovering).toHaveLength(3);
    expect(status.queued).toHaveLength(1);
    expect(status.benched).toHaveLength(3);
    expect(status.unclassifiedCount).toBe(0);
  });

  it('the four lists plus unclassifiedCount reconcile against the hero count', () => {
    expect(totalClassified(status)).toBe(fixture.snapshot.heroes.length);
  });

  it('the benched list is exactly the three inHouse:true benched heroes', () => {
    expect([...heroIds(status.benched)].sort()).toEqual(['12091', '12092', '9367']);
    for (const hero of status.benched) {
      expect(hero.inHouse).toBe(true);
      expect(hero.activity).toBe('benched');
    }
  });

  it('inverting inHouse on every hero leaves classification completely unchanged', () => {
    const inverted: RotationNormalizeResult = {
      ...fixture,
      snapshot: {
        ...fixture.snapshot,
        heroes: fixture.snapshot.heroes.map((hero) => ({ ...hero, inHouse: !hero.inHouse })),
      },
    };
    const invertedStatus = classifyRotation(inverted);
    expect(heroIds(invertedStatus.onField)).toEqual(heroIds(status.onField));
    expect(invertedStatus.recovering.map((entry) => entry.hero.id)).toEqual(
      status.recovering.map((entry) => entry.hero.id),
    );
    expect(heroIds(invertedStatus.queued)).toEqual(heroIds(status.queued));
    expect(heroIds(invertedStatus.benched)).toEqual(heroIds(status.benched));
    expect(invertedStatus.unclassifiedCount).toBe(status.unclassifiedCount);
  });

  it('recovering seconds equal (1 - energyFraction) * cycleSeconds, and hero 12094 has none', () => {
    for (const entry of status.recovering) {
      const fraction = entry.hero.energyFraction;
      expect(fraction).toBeDefined();
      const expectedSeconds = (1 - (fraction ?? 0)) * CYCLE_SECONDS;
      expect(entry.recoverySeconds).toBeCloseTo(expectedSeconds, 6);
    }
    expect(status.recovering.some((entry) => entry.hero.id === '12094')).toBe(false);
    expect(heroIds(status.queued)).toContain('12094');
    const queuedDevin = status.queued.find((hero) => hero.id === '12094');
    expect(queuedDevin).toBeDefined();
  });

  it('occupancy reads 1 of 2', () => {
    expect(status.occupancy).toEqual({ occupied: 1, fieldSize: 2 });
  });

  it('the house panel matches the fixture exactly', () => {
    expect(status.house).toEqual({
      activeHouseIndex: 0,
      activeHouseLevel: 4,
      slots: 3,
      cycleSeconds: 1190.5263157894735,
      rescuesLeft: 7,
      rescuesMax: 15,
    });
  });

  it('no key anywhere in the result reads as a warning, severity, or flag', () => {
    assertNoJudgementKeys(status);
  });

  it('removing cycleSeconds blanks every recovery figure and leaves all four lists identical', () => {
    const house = fixture.snapshot.house;
    const blanked = classifyRotation(
      withHouse(
        house
          ? { activeHouseIndex: house.activeHouseIndex, houseLevels: house.houseLevels, slots: house.slots }
          : undefined,
      ),
    );

    expect(blanked.recovering.every((entry) => !Object.hasOwn(entry, 'recoverySeconds'))).toBe(true);
    expect(heroIds(blanked.onField)).toEqual(heroIds(status.onField));
    expect(blanked.recovering.map((entry) => entry.hero.id)).toEqual(status.recovering.map((entry) => entry.hero.id));
    expect(heroIds(blanked.queued)).toEqual(heroIds(status.queued));
    expect(heroIds(blanked.benched)).toEqual(heroIds(status.benched));
  });

  it('removing activeHouseIndex blanks house identity while recovery figures survive', () => {
    const house = fixture.snapshot.house;
    const blanked = classifyRotation(
      withHouse(
        house ? { houseLevels: house.houseLevels, cycleSeconds: house.cycleSeconds, slots: house.slots } : undefined,
      ),
    );

    expect(blanked.house.activeHouseIndex).toBeUndefined();
    expect(blanked.house.activeHouseLevel).toBeUndefined();
    expect(blanked.house.cycleSeconds).toBe(house?.cycleSeconds);
    expect(blanked.recovering.map((entry) => entry.recoverySeconds)).toEqual(
      status.recovering.map((entry) => entry.recoverySeconds),
    );
  });

  it('an out-of-range activeHouseIndex also blanks house identity', () => {
    const house = fixture.snapshot.house;
    const blanked = classifyRotation(
      withHouse(house ? { ...house, activeHouseIndex: (house.houseLevels?.length ?? 0) + 5 } : undefined),
    );

    expect(blanked.house.activeHouseIndex).toBeUndefined();
    expect(blanked.house.activeHouseLevel).toBeUndefined();
  });

  it('classifying the same snapshot twice gives identical ordering', () => {
    const first = classifyRotation(fixture);
    const second = classifyRotation(fixture);
    expect(heroIds(first.onField)).toEqual(heroIds(second.onField));
    expect(first.recovering.map((entry) => entry.hero.id)).toEqual(second.recovering.map((entry) => entry.hero.id));
    expect(heroIds(first.queued)).toEqual(heroIds(second.queued));
    expect(heroIds(first.benched)).toEqual(heroIds(second.benched));
  });

  it('the recovering list is non-increasing by energy fraction', () => {
    const fractions = status.recovering.map((entry) => entry.hero.energyFraction ?? 0);
    for (let index = 1; index < fractions.length; index += 1) {
      const current = fractions[index];
      const previous = fractions[index - 1];
      expect(current).toBeLessThanOrEqual(previous as number);
    }
  });
});

describe('classifyRotation — a ready hero not yet captured live', () => {
  it('a ready hero with inHouse:false and onField:false classifies as queued, not onField or benched', () => {
    const hero: RotationHeroSnapshot = {
      id: 'ready-1',
      activity: 'ready',
      inHouse: false,
      onField: false,
      energyFraction: 1,
    };
    const status = classifyRotation(snapshotResult({ heroes: [hero] }));

    expect(heroIds(status.queued)).toEqual(['ready-1']);
    expect(status.onField).toHaveLength(0);
    expect(status.benched).toHaveLength(0);
    expect(status.recovering).toHaveLength(0);
  });
});

describe('classifyRotation — queued heroes carry no recovery figure', () => {
  it('a queued hero has no recoverySeconds property at all — not zero, not an unset value', () => {
    const fixtureStatus = classifyRotation(loadFixture());
    const queuedFromFixture = fixtureStatus.queued.find((hero) => hero.id === '12094');
    expect(queuedFromFixture).toBeDefined();
    expect(Object.hasOwn(queuedFromFixture as object, 'recoverySeconds')).toBe(false);

    const readyHero: RotationHeroSnapshot = { id: 'ready-2', activity: 'ready', energyFraction: 0.5 };
    const readyStatus = classifyRotation(snapshotResult({ heroes: [readyHero] }));
    const queuedReady = readyStatus.queued.find((hero) => hero.id === 'ready-2');
    expect(queuedReady).toBeDefined();
    expect(Object.hasOwn(queuedReady as object, 'recoverySeconds')).toBe(false);
  });
});

describe('classifyRotation — queued list groups house-queued heroes before ready heroes', () => {
  it('orders resting-origin heroes before ready heroes, energy descending within each group', () => {
    const heroes: RotationHeroSnapshot[] = [
      { id: 'qy-low', activity: 'ready', energyFraction: 0.2 },
      { id: 'qr-low', activity: 'resting', recovering: false, energyFraction: 0.3 },
      { id: 'qy-high', activity: 'ready', energyFraction: 0.8 },
      { id: 'qr-high', activity: 'resting', recovering: false, energyFraction: 0.9 },
    ];
    const status = classifyRotation(snapshotResult({ heroes }));

    expect(heroIds(status.queued)).toEqual(['qr-high', 'qr-low', 'qy-high', 'qy-low']);
  });
});

describe('classifyRotation — unrecognized activity', () => {
  it('lands in no list, counts as unclassified, and emits one drop', () => {
    const hero = { id: 'weird-1', activity: 'sleeping' } as unknown as RotationHeroSnapshot;
    const status = classifyRotation(snapshotResult({ heroes: [hero] }));

    expect(status.onField).toHaveLength(0);
    expect(status.recovering).toHaveLength(0);
    expect(status.queued).toHaveLength(0);
    expect(status.benched).toHaveLength(0);
    expect(status.unclassifiedCount).toBe(1);
  });

  it('the normalizer drop naming the unrecognized state survives, and is not duplicated', () => {
    const upstream: FieldDrop[] = [{ path: 'heroes[2].state', reason: 'out_of_range' }];
    const heroes: RotationHeroSnapshot[] = [
      { id: 'ok-1', activity: 'inField' },
      { id: 'weird-1', activity: 'sleeping' } as unknown as RotationHeroSnapshot,
    ];
    const status = classifyRotation(snapshotResult({ heroes }, upstream));

    expect(status.drops).toEqual(upstream);
    expect(status.unclassifiedCount).toBe(1);
  });

  it('an unclassified hero still reconciles against the hero count', () => {
    const heroes: RotationHeroSnapshot[] = [
      { id: 'ok-1', activity: 'inField' },
      { id: 'weird-1', activity: 'sleeping' } as unknown as RotationHeroSnapshot,
    ];
    const status = classifyRotation(snapshotResult({ heroes }));

    expect(totalClassified(status)).toBe(2);
  });

  it('a hero missing the activity field entirely also lands in no list, counted unclassified', () => {
    const heroes: RotationHeroSnapshot[] = [{ id: 'no-activity-1' }];
    const status = classifyRotation(snapshotResult({ heroes }));

    expect(status.onField).toHaveLength(0);
    expect(status.recovering).toHaveLength(0);
    expect(status.queued).toHaveLength(0);
    expect(status.benched).toHaveLength(0);
    expect(status.unclassifiedCount).toBe(1);

    expect(totalClassified(status)).toBe(1);
  });
});

describe('classifyRotation — edge cases', () => {
  it('zero heroes: all lists empty, occupancy reads 0 of 2', () => {
    const status = classifyRotation(snapshotResult({ fieldSize: 2 }));

    expect(status.onField).toEqual([]);
    expect(status.recovering).toEqual([]);
    expect(status.queued).toEqual([]);
    expect(status.benched).toEqual([]);
    expect(status.unclassifiedCount).toBe(0);
    expect(status.occupancy).toEqual({ occupied: 0, fieldSize: 2 });
  });

  it('every hero benched: the other three lists stay empty, no error', () => {
    const heroes: RotationHeroSnapshot[] = [
      { id: 'b1', activity: 'benched' },
      { id: 'b2', activity: 'benched' },
    ];
    const status = classifyRotation(snapshotResult({ heroes, fieldSize: 2 }));

    expect(heroIds(status.benched)).toEqual(['b1', 'b2']);
    expect(status.onField).toHaveLength(0);
    expect(status.recovering).toHaveLength(0);
    expect(status.queued).toHaveLength(0);
  });

  it('more recovering:true heroes than slots are all listed as recovering', () => {
    const heroes: RotationHeroSnapshot[] = Array.from({ length: 5 }, (_, index) => ({
      id: `r${String(index)}`,
      activity: 'resting',
      recovering: true,
      energyFraction: 0.5,
    }));
    const status = classifyRotation(snapshotResult({ heroes, house: { cycleSeconds: CYCLE_SECONDS, slots: 2 } }));

    expect(status.recovering).toHaveLength(5);
  });

  it('an inField hero at zero energy stays on the field', () => {
    const heroes: RotationHeroSnapshot[] = [{ id: 'f1', activity: 'inField', energyFraction: 0 }];
    const status = classifyRotation(snapshotResult({ heroes }));

    expect(heroIds(status.onField)).toEqual(['f1']);
  });

  it('occupancy exceeding fieldSize is reported unclamped', () => {
    const heroes: RotationHeroSnapshot[] = [
      { id: 'f1', activity: 'inField' },
      { id: 'f2', activity: 'inField' },
      { id: 'f3', activity: 'inField' },
    ];
    const status = classifyRotation(snapshotResult({ heroes, fieldSize: 2 }));

    expect(status.occupancy).toEqual({ occupied: 3, fieldSize: 2 });
  });

  it('fieldSize absent leaves the list intact with an absent denominator', () => {
    const heroes: RotationHeroSnapshot[] = [{ id: 'f1', activity: 'inField' }];
    const status = classifyRotation(snapshotResult({ heroes }));

    expect(status.occupancy.occupied).toBe(1);
    expect(status.occupancy.fieldSize).toBeUndefined();
  });

  it('a hero with energy and energyMax but no energyFraction gets a derived fraction', () => {
    const heroes: RotationHeroSnapshot[] = [
      { id: 'r1', activity: 'resting', recovering: true, energy: 30, energyMax: 100 },
    ];
    const status = classifyRotation(snapshotResult({ heroes, house: { cycleSeconds: CYCLE_SECONDS } }));

    expect(status.recovering[0]?.recoverySeconds).toBeCloseTo(0.7 * CYCLE_SECONDS, 6);
  });

  it('a hero whose energy exceeds its own ceiling recovers in zero seconds, never a negative time', () => {
    const heroes: RotationHeroSnapshot[] = [
      { id: 'r1', activity: 'resting', recovering: true, energy: 120, energyMax: 100 },
    ];
    const status = classifyRotation(snapshotResult({ heroes, house: { cycleSeconds: CYCLE_SECONDS } }));

    expect(status.recovering[0]?.recoverySeconds).toBe(0);
  });

  it('a hero with none of the three energy fields keeps its list membership with no energy or recovery figure', () => {
    const heroes: RotationHeroSnapshot[] = [{ id: 'r1', activity: 'resting', recovering: true }];
    const status = classifyRotation(snapshotResult({ heroes, house: { cycleSeconds: CYCLE_SECONDS } }));

    expect(status.recovering).toHaveLength(1);
    expect(status.recovering[0]?.hero.energyFraction).toBeUndefined();
    expect(status.recovering[0]?.recoverySeconds).toBeUndefined();
  });
});
