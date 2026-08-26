import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LiveTick, LiveTickHero, RotationHeroSnapshot, RotationSnapshot } from '@bombfarm/contracts';
import { combineDrainRate } from '@bombfarm/domain/drain';
import {
  advanceRecoveryClock,
  createInitialFieldCountdownState,
  ingestFieldCountdownTick,
  resolveFieldDrainMultipliers,
  type DrainMultipliers,
  type FieldCountdownState,
  type RosterHeroAbilities,
} from '@bombfarm/domain/live';

function tick(heroes: readonly LiveTickHero[]): LiveTick {
  return { heroes };
}

function rotationOf(heroes: readonly RotationHeroSnapshot[], cycleSeconds?: number): RotationSnapshot {
  return { heroes, ...(cycleSeconds !== undefined ? { house: { cycleSeconds } } : {}) };
}

describe('ingestFieldCountdownTick — the worked example', () => {
  it('a full pool, no self reduction, two team-aura carriers summing past the cap: 0.8/s, ~6199s remaining', () => {
    const energyMax = 4_959.12;
    const rotation = rotationOf([{ id: 'target', energyMax }]);

    const onField: readonly RosterHeroAbilities[] = [
      { id: 'target', abilities: {} },
      { id: 'carrier-a', abilities: { folego_mineiro: 20 } },
      { id: 'carrier-b', abilities: { folego_mineiro: 13 } },
    ];
    const modelledDrainMultipliers = resolveFieldDrainMultipliers(onField);
    expect(modelledDrainMultipliers.get('target')).toEqual({ selfDrainMult: 1, teamDrainMult: 0.8 });

    const result = ingestFieldCountdownTick(createInitialFieldCountdownState(), {
      tick: tick([{ id: 'target', energyFraction: 1 }]),
      rotation,
      atMs: 0,
      modelledDrainMultipliers,
    });

    const reading = result.field.find((entry) => entry.heroId === 'target');
    expect(reading?.basis).toBe('modelled');
    expect(reading?.drainPerSecond).toBeCloseTo(0.8, 6);
    expect(reading?.secondsRemaining).toBeCloseTo(6198.9, 1);
  });
});

describe('resolveFieldDrainMultipliers — the team-aura cap', () => {
  it('a second carrier at the per-source cap adds nothing once the first has already reached it', () => {
    const oneCarrier = resolveFieldDrainMultipliers([
      { id: 'target', abilities: {} },
      { id: 'carrier', abilities: { folego_mineiro: 20 } },
    ]);
    const twoCarriers = resolveFieldDrainMultipliers([
      { id: 'target', abilities: {} },
      { id: 'carrier-a', abilities: { folego_mineiro: 20 } },
      { id: 'carrier-b', abilities: { folego_mineiro: 20 } },
    ]);

    expect(oneCarrier.get('target')).toEqual(twoCarriers.get('target'));
    expect(combineDrainRate(1, oneCarrier.get('target')!.teamDrainMult)).toBe(
      combineDrainRate(1, twoCarriers.get('target')!.teamDrainMult),
    );
  });
});

describe('ingestFieldCountdownTick — divide, not multiply', () => {
  it("a hero with drain reduction lasts LONGER than one without, for the same energy — dividing energy by the reduced rate, never multiplying", () => {
    const energyMax = 4_959.12;
    const rotation = rotationOf([{ id: 'reduced', energyMax }, { id: 'unreduced', energyMax }]);

    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['reduced', { selfDrainMult: 1, teamDrainMult: 0.8 }], // combineDrainRate(1, 0.8) = 0.8/s
      ['unreduced', { selfDrainMult: 1, teamDrainMult: 1 }], // combineDrainRate(1, 1) = 1.0/s
    ]);

    const result = ingestFieldCountdownTick(createInitialFieldCountdownState(), {
      tick: tick([
        { id: 'reduced', energyFraction: 1 },
        { id: 'unreduced', energyFraction: 1 },
      ]),
      rotation,
      atMs: 0,
      modelledDrainMultipliers,
    });

    const reduced = result.field.find((entry) => entry.heroId === 'reduced')!;
    const unreduced = result.field.find((entry) => entry.heroId === 'unreduced')!;

    expect(reduced.secondsRemaining).toBeGreaterThan(unreduced.secondsRemaining);
    // The arithmetic slip this pins: energy / rate, never energy * rate. Multiplying would give
    // 4959.12 * 0.8 = 3967.296 — shorter than the unreduced hero, which is backwards.
    expect(reduced.secondsRemaining).toBeCloseTo(6198.9, 1);
    expect(reduced.secondsRemaining).not.toBeCloseTo(3967.296, 1);
  });
});

describe('ingestFieldCountdownTick — a hero the app knows nothing about renders no countdown', () => {
  it('no resolvable roster multipliers gets no field entry at all, not a fallback number', () => {
    const rotation = rotationOf([{ id: 'h9', energyMax: 1000 }]);

    const result = ingestFieldCountdownTick(createInitialFieldCountdownState(), {
      tick: tick([{ id: 'h9', energyFraction: 0.5 }]),
      rotation,
      atMs: 0,
      // No modelledDrainMultipliers entry for h9: roster data is unavailable for this hero.
    });

    expect(result.field.find((entry) => entry.heroId === 'h9')).toBeUndefined();
  });
});

describe('ingestFieldCountdownTick — a falling energy series produces a strictly decreasing, smooth countdown', () => {
  it('never steps, including across a change in who else is on the field', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'target', energyMax }, { id: 'noise1', energyMax }, { id: 'noise2', energyMax }]);
    const targetMultipliers: DrainMultipliers = { selfDrainMult: 0.87, teamDrainMult: 1 };
    const noiseMultipliers: DrainMultipliers = { selfDrainMult: 1, teamDrainMult: 1 };
    const INTERVAL_MS = 100;
    const ratePerSecond = combineDrainRate(0.87, 1);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const readings: number[] = [];

    const TOTAL_TICKS = 40;
    for (let i = 0; i < TOTAL_TICKS; i += 1) {
      const atMs = i * INTERVAL_MS;
      const heroesOnField: LiveTickHero[] = [
        { id: 'target', energyFraction: (900 - ratePerSecond * (atMs / 1000)) / energyMax },
      ];
      if (i % 3 < 2) heroesOnField.push({ id: 'noise1', energyFraction: 0.5 });
      if (i % 5 < 3) heroesOnField.push({ id: 'noise2', energyFraction: 0.5 });

      const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
        ['target', targetMultipliers],
        ['noise1', noiseMultipliers],
        ['noise2', noiseMultipliers],
      ]);

      const result = ingestFieldCountdownTick(state, { tick: tick(heroesOnField), rotation, atMs, modelledDrainMultipliers });
      state = result.state;
      const reading = result.field.find((entry) => entry.heroId === 'target');
      expect(reading).toBeDefined();
      expect(reading?.basis).toBe('modelled');
      readings.push(reading!.secondsRemaining);
    }

    for (let i = 1; i < readings.length; i += 1) expect(readings[i]!).toBeLessThan(readings[i - 1]!);

    const diffs = readings.slice(1).map((value, i) => readings[i]! - value);
    for (const diff of diffs) expect(diff).toBeCloseTo(diffs[0]!, 9);
  });
});

describe('ingestFieldCountdownTick — the real capture drives a perfectly smooth countdown', () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'live-capture-energy-fractions.json'), 'utf8'),
  ) as { readonly tickCount: number; readonly energyFractionByHeroId: Record<string, readonly number[]> };
  const heroIds = Object.keys(fixture.energyFractionByHeroId);

  it('carries the shape this test assumes: every hero present on every one of the committed capture ticks', () => {
    expect(heroIds.length).toBe(9);
    for (const heroId of heroIds) expect(fixture.energyFractionByHeroId[heroId]!.length).toBe(fixture.tickCount);
  });

  it('decreases every countdown by exactly the same amount every frame — no stutter, no step', () => {
    const FRAME_INTERVAL_MS = 100;
    const energyMax = 1000;
    const rotation = rotationOf(heroIds.map((id) => ({ id, energyMax })));
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>(
      heroIds.map((id) => [id, { selfDrainMult: 1, teamDrainMult: 1 }]),
    );

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const secondsRemainingByHero = new Map<string, number[]>(heroIds.map((id) => [id, []]));

    for (let i = 0; i < fixture.tickCount; i += 1) {
      const atMs = i * FRAME_INTERVAL_MS;
      const heroes = heroIds.map((id) => ({ id, energyFraction: fixture.energyFractionByHeroId[id]![i]! }));
      const result = ingestFieldCountdownTick(state, { tick: tick(heroes), rotation, atMs, modelledDrainMultipliers });
      state = result.state;
      for (const heroId of heroIds) {
        const reading = result.field.find((entry) => entry.heroId === heroId);
        if (reading !== undefined) secondsRemainingByHero.get(heroId)!.push(reading.secondsRemaining);
      }
    }

    for (const heroId of heroIds) {
      const readings = secondsRemainingByHero.get(heroId)!;
      expect(readings.length).toBe(fixture.tickCount);
      const diffs = readings.slice(1).map((value, i) => readings[i]! - value);
      for (const diff of diffs) expect(diff).toBeCloseTo(diffs[0]!, 9);
    }
  });
});

describe('ingestFieldCountdownTick — the background checker', () => {
  it('logs a disagreement when the observed rate and the law diverge by more than the margin', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);
    // The law says 0.8/s; the energy series actually falls at 1.0/s — a 25% gap, well past the margin.
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([['h', { selfDrainMult: 1, teamDrainMult: 0.8 }]]);
    const trueRatePerSecond = 1.0;
    const INTERVAL_MS = 100;

    let state: FieldCountdownState = createInitialFieldCountdownState();
    let totalDisagreements = 0;
    for (let i = 0; i < 5; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: (900 - trueRatePerSecond * (atMs / 1000)) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      totalDisagreements += result.disagreements.length;
    }

    expect(totalDisagreements).toBe(1);
  });

  it('stays silent across the whole run when the observed rate agrees with the law', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([['h', { selfDrainMult: 1, teamDrainMult: 0.8 }]]);
    const trueRatePerSecond = combineDrainRate(1, 0.8);
    const INTERVAL_MS = 100;

    let state: FieldCountdownState = createInitialFieldCountdownState();
    let totalDisagreements = 0;
    for (let i = 0; i < 10; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: (900 - trueRatePerSecond * (atMs / 1000)) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      totalDisagreements += result.disagreements.length;
    }

    expect(totalDisagreements).toBe(0);
  });

  it('a rest-sourced sample never feeds the checker, however far its energy reading is from the law', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([['h', { selfDrainMult: 1, teamDrainMult: 0.8 }]]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    let totalDisagreements = 0;
    const restIntervalMs = 3_000;
    for (let i = 0; i < 5; i += 1) {
      const atMs = i * restIntervalMs;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: (900 - 1.0 * (atMs / 1000)) / energyMax }]),
        rotation,
        atMs,
        sampleSource: 'rest',
        modelledDrainMultipliers,
      });
      state = result.state;
      totalDisagreements += result.disagreements.length;
    }

    expect(totalDisagreements).toBe(0);
  });
});

describe('ingestFieldCountdownTick — the hero-snapshot lookup is computed once per rotation, not once per frame', () => {
  it('reuses the same hero-snapshot lookup across ticks that share the same rotation object reference', () => {
    const rotation = rotationOf([{ id: 'h1', energyMax: 1000 }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([['h1', { selfDrainMult: 1, teamDrainMult: 1 }]]);

    const first = ingestFieldCountdownTick(createInitialFieldCountdownState(), {
      tick: tick([{ id: 'h1', energyFraction: 0.9 }]),
      rotation,
      atMs: 0,
      modelledDrainMultipliers,
    });
    const second = ingestFieldCountdownTick(first.state, {
      tick: tick([{ id: 'h1', energyFraction: 0.89 }]),
      rotation,
      atMs: 100,
      modelledDrainMultipliers,
    });

    expect(second.state.rotationCache).toBe(first.state.rotationCache);
  });
});

describe('ingestFieldCountdownTick — onFieldHeroIdsSorted is rebuilt only when membership actually changes', () => {
  it('keeps the same array reference across ticks that report the same on-field ids, in any order', () => {
    const rotation = rotationOf([{ id: 'h1' }, { id: 'h2' }]);
    let state: FieldCountdownState = createInitialFieldCountdownState();

    const first = ingestFieldCountdownTick(state, { tick: tick([{ id: 'h1' }, { id: 'h2' }]), rotation, atMs: 0 });
    state = first.state;
    const second = ingestFieldCountdownTick(state, { tick: tick([{ id: 'h2' }, { id: 'h1' }]), rotation, atMs: 100 });

    expect(second.state.onFieldHeroIdsSorted).toBe(first.state.onFieldHeroIdsSorted);
    expect(second.state.onFieldHeroIdsSorted).toEqual(['h1', 'h2']);
  });

  it('rebuilds to a new, correctly sorted array the moment membership genuinely changes', () => {
    const rotation = rotationOf([{ id: 'h1' }, { id: 'h2' }]);
    let state: FieldCountdownState = createInitialFieldCountdownState();

    const first = ingestFieldCountdownTick(state, { tick: tick([{ id: 'h1' }]), rotation, atMs: 0 });
    state = first.state;
    const second = ingestFieldCountdownTick(state, { tick: tick([{ id: 'h1' }, { id: 'h2' }]), rotation, atMs: 100 });

    expect(second.state.onFieldHeroIdsSorted).not.toBe(first.state.onFieldHeroIdsSorted);
    expect(second.state.onFieldHeroIdsSorted).toEqual(['h1', 'h2']);
  });
});

describe('advanceRecoveryClock — recovery ticks in real time between account reads, and freezes when the connection drops', () => {
  it('decreases second by second while connected, then holds flat the instant the connection is lost', () => {
    const rotation = rotationOf([{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.5 }], 600);
    const read = ingestFieldCountdownTick(createInitialFieldCountdownState(), { tick: tick([]), rotation, atMs: 1_000 });

    const atRead = advanceRecoveryClock(read.state, 1_000, true);
    expect(atRead.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 300, advancing: true }]);

    const oneSecondLater = advanceRecoveryClock(atRead.state, 2_000, true);
    expect(oneSecondLater.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 299, advancing: true }]);

    const fiveSecondsLater = advanceRecoveryClock(oneSecondLater.state, 6_000, true);
    expect(fiveSecondsLater.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 295, advancing: true }]);

    const disconnected = advanceRecoveryClock(fiveSecondsLater.state, 10_000, false);
    expect(disconnected.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 295, advancing: false }]);

    // Time keeps passing in the real world while disconnected, but the displayed figure must not:
    // a second disconnected call, ten seconds later still, reports the exact same frozen value.
    const stillDisconnected = advanceRecoveryClock(disconnected.state, 20_000, false);
    expect(stillDisconnected.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 295, advancing: false }]);
  });

  it('a fresh account read overrides a frozen figure outright, even while still disconnected', () => {
    const rotation1 = rotationOf([{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.5 }], 600);
    const rotation2 = rotationOf([{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.7 }], 600);

    const firstRead = ingestFieldCountdownTick(createInitialFieldCountdownState(), { tick: tick([]), rotation: rotation1, atMs: 0 });
    const frozen = advanceRecoveryClock(firstRead.state, 5_000, false);
    expect(frozen.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 300, advancing: false }]);

    const secondRead = ingestFieldCountdownTick(frozen.state, { tick: tick([]), rotation: rotation2, atMs: 5_000 });
    const afterFreshRead = advanceRecoveryClock(secondRead.state, 5_000, false);
    expect(afterFreshRead.recovery).toHaveLength(1);
    expect(afterFreshRead.recovery[0]).toMatchObject({ heroId: 'h5', advancing: false });
    expect(afterFreshRead.recovery[0]!.secondsRemaining).toBeCloseTo(180, 9);
  });

  it('reports nothing before any rotation has ever been read', () => {
    const result = advanceRecoveryClock(createInitialFieldCountdownState(), 1_000, true);
    expect(result.recovery).toEqual([]);
  });
});
