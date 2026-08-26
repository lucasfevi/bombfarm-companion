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
  it("an aura carrier leaving mid-field raises every remaining hero's drain, but the rate eases toward the new estimate instead of jumping to it", () => {
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

    // Fewer than MIN_TRUSTED_SAMPLES ticks, so the fit never re-earns trust during this window
    // and every reading below is driven purely by the blend, not by a fresh observed fit.
    const STEPS = 5;
    let afterState = state;
    const ratesByHero = new Map<string, number[]>([['h2', []], ['h3', []]]);
    let heroIdsAtFirstStep: string[] = [];

    for (let i = 0; i < STEPS; i += 1) {
      const atMs = departureAtMs + i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(afterState, {
        tick: tick([
          { id: 'h2', energyFraction: (energyAt(900, 0.7, departureAtMs) - i * INTERVAL_MS / 1000) / energyMax },
          { id: 'h3', energyFraction: (energyAt(900, 0.65, departureAtMs) - i * INTERVAL_MS / 1000) / energyMax },
        ]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      afterState = result.state;
      if (i === 0) heroIdsAtFirstStep = result.field.map((c) => c.heroId).sort();
      for (const heroId of ['h2', 'h3']) {
        const reading = result.field.find((c) => c.heroId === heroId)!;
        expect(reading.basis).toBe('modelled');
        ratesByHero.get(heroId)!.push(reading.drainPerSecond);
      }
    }

    expect(heroIdsAtFirstStep).toEqual(['h2', 'h3']);

    for (const heroId of ['h2', 'h3']) {
      const rates = ratesByHero.get(heroId)!;
      // No step at the transition: the very first post-departure reading starts from exactly
      // the pre-departure observed rate, not an instant jump to the new modelled estimate.
      expect(rates[0]).toBe(beforeByHero.get(heroId)!);
      for (let i = 1; i < rates.length; i += 1) expect(rates[i]!).toBeGreaterThanOrEqual(rates[i - 1]!);
      expect(rates[rates.length - 1]!).toBeGreaterThan(beforeByHero.get(heroId)!);
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

describe('ingestFieldCountdownTick — rate blending across a composition change', () => {
  it("a hero's displayed remaining time decreases monotonically through a composition change and the fit's later recovery, with no step at either transition", () => {
    const energyMax = 1000;
    const startEnergy = 950;
    const trueRatePerSecond = 0.8; // the hero's field energy never actually changes rate
    const rotation = rotationOf([{ id: 'h', energyMax }]);

    // The estimate before the change agrees with the truth, so the first trust transition is
    // clean; the estimate after does not, reproducing "the modelled law and the measured rate
    // never agree exactly" once the hero's own multipliers change.
    const multipliersBefore: DrainMultipliers = { selfDrainMult: 0.8, teamDrainMult: 1 };
    const multipliersAfter: DrainMultipliers = { selfDrainMult: 1, teamDrainMult: 1 };
    const CHANGE_AT_INDEX = 15;
    const TOTAL_TICKS = 40;

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const readings: { secondsRemaining: number; drainPerSecond: number; basis: string }[] = [];

    for (let i = 0; i < TOTAL_TICKS; i += 1) {
      const atMs = i * INTERVAL_MS;
      const multipliers = i < CHANGE_AT_INDEX ? multipliersBefore : multipliersAfter;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: energyAt(startEnergy, trueRatePerSecond, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers: new Map([['h', multipliers]]),
      });
      state = result.state;
      const reading = result.field.find((c) => c.heroId === 'h')!;
      readings.push({ secondsRemaining: reading.secondsRemaining, drainPerSecond: reading.drainPerSecond, basis: reading.basis });
    }

    expect(readings.some((r) => r.basis === 'observed')).toBe(true);
    expect(readings.some((r) => r.basis === 'modelled')).toBe(true);

    for (let i = 1; i < readings.length; i += 1) {
      expect(readings[i]!.secondsRemaining).toBeLessThanOrEqual(readings[i - 1]!.secondsRemaining);
    }

    // The rate itself must not jump at the composition change either: a step here is exactly
    // what an instant fall-back to the modelled estimate used to produce.
    expect(readings[CHANGE_AT_INDEX]!.drainPerSecond).toBe(readings[CHANGE_AT_INDEX - 1]!.drainPerSecond);
  });

  it('a blended rate always reports as modelled, never as observed', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);
    const rate = 0.8;

    let state: FieldCountdownState = createInitialFieldCountdownState();
    for (let i = 0; i < 8; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: energyAt(900, rate, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers: new Map([['h', { selfDrainMult: 0.8, teamDrainMult: 1 }]]),
      });
      state = result.state;
      if (i === 7) expect(result.field[0]!.basis).toBe('observed');
    }

    // Fewer than MIN_TRUSTED_SAMPLES ticks after the change: the fit cannot have re-earned
    // trust, so every one of these readings must come from the blend.
    for (let i = 8; i < 13; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: energyAt(900, rate, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers: new Map([['h', { selfDrainMult: 1, teamDrainMult: 1 }]]),
      });
      state = result.state;
      expect(result.field[0]!.basis).toBe('modelled');
    }
  });
});

describe('ingestFieldCountdownTick — the never-rise clamp', () => {
  it("releases when a hero's energy genuinely rises, such as a recharge", () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    let beforeRecharge: number | undefined;

    for (let i = 0; i < 10; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: energyAt(900, 0.8, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      if (i === 9) beforeRecharge = result.field[0]!.secondsRemaining;
    }

    const rechargeAtMs = 10 * INTERVAL_MS;
    const recharged = ingestFieldCountdownTick(state, {
      tick: tick([{ id: 'h', energyFraction: 0.99 }]),
      rotation,
      atMs: rechargeAtMs,
      modelledDrainMultipliers,
    });

    expect(recharged.field[0]!.secondsRemaining).toBeGreaterThan(beforeRecharge!);
  });

  it('holds the remaining time flat, never raising it, when only the rate estimate falls and energy has not risen', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    let beforeChangeRemaining = 0;
    for (let i = 0; i < 8; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: energyAt(900, 0.8, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers: new Map([['h', { selfDrainMult: 0.8, teamDrainMult: 1 }]]),
      });
      state = result.state;
      if (i === 7) beforeChangeRemaining = result.field[0]!.secondsRemaining;
    }

    const pinnedEnergy = energyAt(900, 0.8, 7 * INTERVAL_MS);

    // The multipliers now imply a much slower rate (DRAIN_RATE_FLOOR, 0.6/s — both terms at
    // their reduction cap) while the reported energy is pinned at its prior value: without the
    // clamp, dividing an unchanged energy by a falling rate reads as more remaining time even
    // though the hero's own energy hasn't moved. Fewer than MIN_TRUSTED_SAMPLES ticks, so the
    // fit never re-earns trust and every reading here is the blend.
    let maxRemainingAfterChange = 0;
    for (let i = 8; i < 15; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: pinnedEnergy / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers: new Map([['h', { selfDrainMult: 0.8, teamDrainMult: 0.8 }]]),
      });
      state = result.state;
      maxRemainingAfterChange = Math.max(maxRemainingAfterChange, result.field[0]!.secondsRemaining);
    }

    expect(maxRemainingAfterChange).toBeLessThanOrEqual(beforeChangeRemaining);
  });
});
