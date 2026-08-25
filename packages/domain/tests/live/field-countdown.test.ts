import { describe, expect, it } from 'vitest';
import type { LiveTick, LiveTickHero, RotationHeroSnapshot, RotationSnapshot } from '@bombfarm/contracts';
import { combineDrainRate } from '@bombfarm/domain/drain';
import {
  createInitialFieldCountdownState,
  freezeRecoveryCountdowns,
  ingestFieldCountdownTick,
  type DrainMultipliers,
  type FieldCountdownState,
} from '@bombfarm/domain/live';

const INTERVAL_MS = 300;

function tick(heroes: readonly LiveTickHero[]): LiveTick {
  return { heroes };
}

function rotationOf(heroes: readonly RotationHeroSnapshot[], cycleSeconds?: number): RotationSnapshot {
  return { heroes, ...(cycleSeconds !== undefined ? { house: { cycleSeconds } } : {}) };
}

function energyAt(startEnergy: number, ratePerSecond: number, atMs: number): number {
  return startEnergy - (ratePerSecond * atMs) / 1000;
}

describe('ingestFieldCountdownTick — provenance', () => {
  it("a hero's first countdown is modelled, and a later one (once trusted) is observed", () => {
    const energyMax = 1000;
    const startEnergy = 900;
    const ratePerSecond = 0.8;
    const rotation = rotationOf([{ id: 'h1', energyMax }]);

    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h1', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    let firstBasis: string | undefined;
    let laterBasis: string | undefined;
    let laterRate: number | undefined;

    for (let i = 0; i < 10; i += 1) {
      const atMs = i * INTERVAL_MS;
      const energy = energyAt(startEnergy, ratePerSecond, atMs);
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h1', energyFraction: energy / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      if (i === 0) firstBasis = result.field[0].basis;
      if (i === 7) {
        laterBasis = result.field[0].basis;
        laterRate = result.field[0].drainPerSecond;
      }
    }

    expect(firstBasis).toBe('modelled');
    expect(laterBasis).toBe('observed');
    expect(laterRate).toBeCloseTo(ratePerSecond, 6);
  });

  it('the modelled path agrees with combineDrainRate, not a local reimplementation', () => {
    const rotation = rotationOf([{ id: 'h1', energyMax: 1000 }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h1', { selfDrainMult: 0.8, teamDrainMult: 0.9 }],
    ]);

    const result = ingestFieldCountdownTick(createInitialFieldCountdownState(), {
      tick: tick([{ id: 'h1', energyFraction: 0.9 }]),
      rotation,
      atMs: 0,
      modelledDrainMultipliers,
    });

    expect(result.field[0].basis).toBe('modelled');
    expect(result.field[0].drainPerSecond).toBe(combineDrainRate(0.8, 0.9));
  });
});

describe('ingestFieldCountdownTick — sample provenance', () => {
  it("a REST-sourced tick never earns 'observed', even once its samples would trivially pass every trust gate", () => {
    const energyMax = 1000;
    const ratePerSecond = 0.8;
    const rotation = rotationOf([{ id: 'h7', energyMax }]);
    // Deliberately inside MAX_SAMPLE_AGE_MS (30s), unlike the ~60s production refresh cadence —
    // that gate alone would otherwise evict every sample before 8 could accumulate, masking
    // whether `sampleSource` is the thing actually stopping this from ever being trusted.
    const restIntervalMs = 3_000;
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h7', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const bases: string[] = [];

    for (let i = 0; i < 14; i += 1) {
      const atMs = i * restIntervalMs;
      const energy = energyAt(900, ratePerSecond, atMs);
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h7', energyFraction: energy / energyMax }]),
        rotation,
        atMs,
        sampleSource: 'rest',
        modelledDrainMultipliers,
      });
      state = result.state;
      bases.push(result.field[0].basis);
    }

    expect(bases.every((basis) => basis === 'modelled')).toBe(true);

    // The same energy sequence, fed as 'tap' frames instead, does earn 'observed' — proving
    // `sampleSource` is what suppressed it above, not some other gate rejecting these samples.
    let tapState: FieldCountdownState = createInitialFieldCountdownState();
    let tapBases: string[] = [];
    for (let i = 0; i < 14; i += 1) {
      const atMs = i * restIntervalMs;
      const energy = energyAt(900, ratePerSecond, atMs);
      const result = ingestFieldCountdownTick(tapState, {
        tick: tick([{ id: 'h7', energyFraction: energy / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      tapState = result.state;
      tapBases = [...tapBases, result.field[0].basis];
    }
    expect(tapBases).toContain('observed');
  });
});

describe('ingestFieldCountdownTick — field-membership recompute', () => {
  it("an aura carrier leaving mid-field raises every remaining hero's drain, invalidating their fits", () => {
    const energyMax = 1000;
    const rotation = rotationOf([
      { id: 'carrier', energyMax },
      { id: 'h2', energyMax },
      { id: 'h3', energyMax },
    ]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    let beforeByHero = new Map<string, number>();

    for (let i = 0; i < 10; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([
          { id: 'carrier', energyFraction: energyAt(900, 0.6, atMs) / energyMax },
          { id: 'h2', energyFraction: energyAt(900, 0.7, atMs) / energyMax },
          { id: 'h3', energyFraction: energyAt(900, 0.65, atMs) / energyMax },
        ]),
        rotation,
        atMs,
      });
      state = result.state;
      if (i === 9) {
        beforeByHero = new Map(result.field.map((c) => [c.heroId, c.drainPerSecond] as const));
        expect(result.field.find((c) => c.heroId === 'h2')?.basis).toBe('observed');
        expect(result.field.find((c) => c.heroId === 'h3')?.basis).toBe('observed');
      }
    }

    const departureAtMs = 10 * INTERVAL_MS;
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h2', { selfDrainMult: 1, teamDrainMult: 1 }],
      ['h3', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);
    const afterDeparture = ingestFieldCountdownTick(state, {
      tick: tick([
        { id: 'h2', energyFraction: energyAt(900, 0.7, departureAtMs) / energyMax },
        { id: 'h3', energyFraction: energyAt(900, 0.65, departureAtMs) / energyMax },
      ]),
      rotation,
      atMs: departureAtMs,
      modelledDrainMultipliers,
    });

    expect(afterDeparture.field.map((c) => c.heroId).sort()).toEqual(['h2', 'h3']);

    for (const heroId of ['h2', 'h3']) {
      const after = afterDeparture.field.find((c) => c.heroId === heroId)!;
      expect(after.basis).toBe('modelled');
      expect(after.drainPerSecond).toBeGreaterThan(beforeByHero.get(heroId)!);
    }
  });

  it("a non-carrier joining or leaving the field leaves every other hero's rate and basis unchanged", () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h1', energyMax }, { id: 'noise', energyMax }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h1', { selfDrainMult: 1, teamDrainMult: 1 }],
      ['noise', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    for (let i = 0; i < 8; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h1', energyFraction: energyAt(900, 0.8, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      if (i === 7) expect(result.field.find((c) => c.heroId === 'h1')?.basis).toBe('observed');
    }

    const joinAtMs = 8 * INTERVAL_MS;
    const joined = ingestFieldCountdownTick(state, {
      tick: tick([
        { id: 'h1', energyFraction: energyAt(900, 0.8, joinAtMs) / energyMax },
        { id: 'noise', energyFraction: 0.5 },
      ]),
      rotation,
      atMs: joinAtMs,
      modelledDrainMultipliers,
    });
    state = joined.state;
    expect(joined.field.find((c) => c.heroId === 'h1')?.basis).toBe('observed');

    const leaveAtMs = 9 * INTERVAL_MS;
    const left = ingestFieldCountdownTick(state, {
      tick: tick([{ id: 'h1', energyFraction: energyAt(900, 0.8, leaveAtMs) / energyMax }]),
      rotation,
      atMs: leaveAtMs,
      modelledDrainMultipliers,
    });
    expect(left.field.find((c) => c.heroId === 'h1')?.basis).toBe('observed');
    expect(left.field.find((c) => c.heroId === 'h1')?.drainPerSecond).toBeCloseTo(0.8, 1);
  });

  it('a hero that appears and leaves before a slope can be fitted never gets an observed countdown', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h4', energyMax }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h4', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);
    let state: FieldCountdownState = createInitialFieldCountdownState();
    const observedBases: string[] = [];

    for (let i = 0; i < 5; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h4', energyFraction: energyAt(900, 0.8, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      observedBases.push(result.field[0].basis);
    }

    const departed = ingestFieldCountdownTick(state, { tick: tick([]), rotation, atMs: 5 * INTERVAL_MS });
    state = departed.state;
    expect(departed.field).toEqual([]);

    const rejoined = ingestFieldCountdownTick(state, {
      tick: tick([{ id: 'h4', energyFraction: 0.9 }]),
      rotation,
      atMs: 6 * INTERVAL_MS,
      modelledDrainMultipliers,
    });
    observedBases.push(rejoined.field[0].basis);

    expect(observedBases.every((basis) => basis === 'modelled')).toBe(true);
    expect(observedBases).not.toContain('observed');
  });
});

describe('ingestFieldCountdownTick — rejection reporting', () => {
  it('a fitted rate outside [0.60, 1.0] reports exactly once per field visit, and again on a fresh visit', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h6', energyMax }]);
    let state: FieldCountdownState = createInitialFieldCountdownState();
    const rejectionCounts: number[] = [];

    for (let i = 0; i < 10; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h6', energyFraction: energyAt(900, 1.5, atMs) / energyMax }]),
        rotation,
        atMs,
      });
      state = result.state;
      rejectionCounts.push(result.rejections.length);
    }

    expect(rejectionCounts.filter((count) => count > 0)).toEqual([1]);
    expect(rejectionCounts.reduce((sum, count) => sum + count, 0)).toBe(1);

    const departed = ingestFieldCountdownTick(state, { tick: tick([]), rotation, atMs: 10 * INTERVAL_MS });
    state = departed.state;

    const freshVisitCounts: number[] = [];
    for (let i = 11; i < 19; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h6', energyFraction: energyAt(900, 1.5, atMs - 11 * INTERVAL_MS) / energyMax }]),
        rotation,
        atMs,
      });
      state = result.state;
      freshVisitCounts.push(result.rejections.length);
    }

    expect(freshVisitCounts.filter((count) => count > 0)).toEqual([1]);
  });
});

describe('ingestFieldCountdownTick — recovery and the hero-snapshot lookup are computed once per rotation, not once per frame', () => {
  it('recovery keeps the same array reference across ticks that reuse the same rotation object', () => {
    const rotation = rotationOf([{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.5 }], 600);
    let state: FieldCountdownState = createInitialFieldCountdownState();

    const first = ingestFieldCountdownTick(state, { tick: tick([]), rotation, atMs: 0 });
    state = first.state;
    const second = ingestFieldCountdownTick(state, { tick: tick([]), rotation, atMs: 100 });

    expect(second.recovery).toBe(first.recovery);
  });

  it('a genuinely new rotation reference recomputes recovery, even one carrying identical content', () => {
    const rotationA = rotationOf([{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.5 }], 600);
    const rotationB = rotationOf([{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.5 }], 600);
    let state: FieldCountdownState = createInitialFieldCountdownState();

    const first = ingestFieldCountdownTick(state, { tick: tick([]), rotation: rotationA, atMs: 0 });
    state = first.state;
    const second = ingestFieldCountdownTick(state, { tick: tick([]), rotation: rotationB, atMs: 100 });

    expect(second.recovery).not.toBe(first.recovery);
    expect(second.recovery).toEqual(first.recovery);
  });
});

describe('ingestFieldCountdownTick / freezeRecoveryCountdowns — recovery', () => {
  it('recovery is recomputed fresh from each frame and freezes on the last value when frames stop', () => {
    const rotation1 = rotationOf(
      [{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.5 }],
      600,
    );
    const rotation2 = rotationOf(
      [{ id: 'h5', activity: 'resting', recovering: true, energyFraction: 0.6 }],
      600,
    );

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const first = ingestFieldCountdownTick(state, { tick: tick([]), rotation: rotation1, atMs: 0 });
    state = first.state;
    expect(first.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 300, advancing: true }]);

    const second = ingestFieldCountdownTick(state, { tick: tick([]), rotation: rotation2, atMs: 300 });
    state = second.state;
    expect(second.recovery).toEqual([{ heroId: 'h5', secondsRemaining: 240, advancing: true }]);

    const frozen = freezeRecoveryCountdowns(state);
    expect(frozen).toEqual([{ heroId: 'h5', secondsRemaining: 240, advancing: false }]);
  });
});

describe('ingestFieldCountdownTick — onFieldHeroIdsSorted is rebuilt only when membership actually changes', () => {
  it('keeps the same array reference across ticks that report the same on-field ids, in any order', () => {
    const rotation = rotationOf([{ id: 'h1' }, { id: 'h2' }]);
    let state: FieldCountdownState = createInitialFieldCountdownState();

    const first = ingestFieldCountdownTick(state, { tick: tick([{ id: 'h1' }, { id: 'h2' }]), rotation, atMs: 0 });
    state = first.state;
    const second = ingestFieldCountdownTick(state, {
      tick: tick([{ id: 'h2' }, { id: 'h1' }]),
      rotation,
      atMs: INTERVAL_MS,
    });

    expect(second.state.onFieldHeroIdsSorted).toBe(first.state.onFieldHeroIdsSorted);
    expect(second.state.onFieldHeroIdsSorted).toEqual(['h1', 'h2']);
  });

  it('rebuilds to a new, correctly sorted array the moment membership genuinely changes', () => {
    const rotation = rotationOf([{ id: 'h1' }, { id: 'h2' }]);
    let state: FieldCountdownState = createInitialFieldCountdownState();

    const first = ingestFieldCountdownTick(state, { tick: tick([{ id: 'h1' }]), rotation, atMs: 0 });
    state = first.state;
    const second = ingestFieldCountdownTick(state, {
      tick: tick([{ id: 'h1' }, { id: 'h2' }]),
      rotation,
      atMs: INTERVAL_MS,
    });

    expect(second.state.onFieldHeroIdsSorted).not.toBe(first.state.onFieldHeroIdsSorted);
    expect(second.state.onFieldHeroIdsSorted).toEqual(['h1', 'h2']);
  });
});

describe('ingestFieldCountdownTick — a hero the app knows nothing about renders no countdown', () => {
  it('an untrusted fit with no resolvable roster data gets no field entry at all, not a fallback number', () => {
    const rotation = rotationOf([{ id: 'h9', energyMax: 1000 }]);

    const result = ingestFieldCountdownTick(createInitialFieldCountdownState(), {
      tick: tick([{ id: 'h9', energyFraction: 0.5 }]),
      rotation,
      atMs: 0,
      // No modelledDrainMultipliers entry for h9: roster data is unavailable for this hero.
    });

    expect(result.field.find((c) => c.heroId === 'h9')).toBeUndefined();
  });
});

describe('ingestFieldCountdownTick — countdown stability regression', () => {
  it("a hero's remaining field time never increases while its own drain conditions stay constant, even as unrelated heroes repeatedly join and leave the field", () => {
    const energyMax = 1000;
    const targetRate = 0.8; // combineDrainRate(0.8, 1) — the target's own Bateria Extra, no team aura
    const rotation = rotationOf([
      { id: 'target', energyMax },
      { id: 'noise1', energyMax },
      { id: 'noise2', energyMax },
    ]);

    const targetMultipliers: DrainMultipliers = { selfDrainMult: 0.8, teamDrainMult: 1 };
    const noiseMultipliers: DrainMultipliers = { selfDrainMult: 1, teamDrainMult: 1 };

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const remainingReadings: number[] = [];

    const TOTAL_TICKS = 40;
    for (let i = 0; i < TOTAL_TICKS; i += 1) {
      const atMs = i * INTERVAL_MS;
      const heroesOnField: LiveTickHero[] = [
        { id: 'target', energyFraction: energyAt(900, targetRate, atMs) / energyMax },
      ];
      // Unaligned periods (3 and 5) put a membership change on nearly every tick, never settling.
      if (i % 3 < 2) heroesOnField.push({ id: 'noise1', energyFraction: 0.5 });
      if (i % 5 < 3) heroesOnField.push({ id: 'noise2', energyFraction: 0.5 });

      const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
        ['target', targetMultipliers],
        ['noise1', noiseMultipliers],
        ['noise2', noiseMultipliers],
      ]);

      const result = ingestFieldCountdownTick(state, {
        tick: tick(heroesOnField),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;

      const targetReading = result.field.find((c) => c.heroId === 'target');
      expect(targetReading).toBeDefined();
      remainingReadings.push(targetReading!.secondsRemaining);
    }

    for (let i = 1; i < remainingReadings.length; i += 1) {
      expect(remainingReadings[i]!).toBeLessThanOrEqual(remainingReadings[i - 1]!);
    }
  });
});
