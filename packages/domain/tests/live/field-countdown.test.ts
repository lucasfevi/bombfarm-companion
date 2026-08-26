import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LiveTick, LiveTickHero, RotationHeroSnapshot, RotationSnapshot } from '@bombfarm/contracts';
import { combineDrainRate } from '@bombfarm/domain/drain';
import {
  createInitialFieldCountdownState,
  freezeRecoveryCountdowns,
  ingestFieldCountdownTick,
  MIN_FRAME_CLOCK_SAMPLES,
  type DrainMultipliers,
  type FieldCountdownState,
} from '@bombfarm/domain/live';

const INTERVAL_MS = 300;
/** Comfortably past {@link MIN_FRAME_CLOCK_SAMPLES} gaps so the shared frame clock — warmed up
 *  once, globally, independent of any one hero — is measured by the last iteration of a warm-up
 *  loop. */
const WARM_UP_TICKS = MIN_FRAME_CLOCK_SAMPLES + 2;

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

    for (let i = 0; i < WARM_UP_TICKS + 1; i += 1) {
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
      if (i === WARM_UP_TICKS) {
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
    // Deliberately inside the shared frame clock's window, unlike the ~60s production refresh
    // cadence — that alone would otherwise never accumulate enough gaps to warm the clock,
    // masking whether `sampleSource` is the thing actually stopping this from ever being trusted.
    const restIntervalMs = 3_000;
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h7', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const bases: string[] = [];

    for (let i = 0; i < WARM_UP_TICKS + 2; i += 1) {
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
    for (let i = 0; i < WARM_UP_TICKS + 2; i += 1) {
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
  it("a non-carrier joining or leaving the field leaves every other hero's rate and basis unchanged", () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h1', energyMax }, { id: 'noise', energyMax }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h1', { selfDrainMult: 1, teamDrainMult: 1 }],
      ['noise', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    for (let i = 0; i < WARM_UP_TICKS + 1; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h1', energyFraction: energyAt(900, 0.8, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      if (i === WARM_UP_TICKS) expect(result.field.find((c) => c.heroId === 'h1')?.basis).toBe('observed');
    }

    const joinAtMs = (WARM_UP_TICKS + 1) * INTERVAL_MS;
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

    const leaveAtMs = (WARM_UP_TICKS + 2) * INTERVAL_MS;
    const left = ingestFieldCountdownTick(state, {
      tick: tick([{ id: 'h1', energyFraction: energyAt(900, 0.8, leaveAtMs) / energyMax }]),
      rotation,
      atMs: leaveAtMs,
      modelledDrainMultipliers,
    });
    expect(left.field.find((c) => c.heroId === 'h1')?.basis).toBe('observed');
    expect(left.field.find((c) => c.heroId === 'h1')?.drainPerSecond).toBeCloseTo(0.8, 1);
  });

  it('a hero that appears and leaves before a rate can be measured never gets an observed countdown', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h4', energyMax }]);
    const modelledDrainMultipliers = new Map<string, DrainMultipliers>([
      ['h4', { selfDrainMult: 1, teamDrainMult: 1 }],
    ]);
    let state: FieldCountdownState = createInitialFieldCountdownState();
    const observedBases: string[] = [];

    // Deliberately fewer ticks than MIN_FRAME_CLOCK_SAMPLES: the shared frame clock never warms
    // up across this whole scenario, so 'observed' should never be reachable regardless of how
    // quickly this one hero's own delta becomes known.
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
  it('an out-of-range observed rate reports exactly once per field visit, and again on a fresh visit', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h6', energyMax }]);
    let state: FieldCountdownState = createInitialFieldCountdownState();
    const rejectionCounts: number[] = [];

    for (let i = 0; i < WARM_UP_TICKS + 2; i += 1) {
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

    const departedAtMs = (WARM_UP_TICKS + 2) * INTERVAL_MS;
    const departed = ingestFieldCountdownTick(state, { tick: tick([]), rotation, atMs: departedAtMs });
    state = departed.state;

    const freshVisitCounts: number[] = [];
    for (let i = 0; i < WARM_UP_TICKS + 2; i += 1) {
      const atMs = departedAtMs + (i + 1) * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h6', energyFraction: energyAt(900, 1.5, i * INTERVAL_MS) / energyMax }]),
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
  it('an untrusted rate with no resolvable roster data gets no field entry at all, not a fallback number', () => {
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

describe('ingestFieldCountdownTick — a genuine rate change is adopted instantly, in both directions', () => {
  function steppedDrain(count: number, startEnergy: number, deltaPerFrame: number): number[] {
    return Array.from({ length: count }, (_, i) => startEnergy - i * deltaPerFrame);
  }

  it("an aura carrier leaving mid-field speeds up the remaining hero's countdown on the very next frame, with no multi-tick easing", () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'carrier', energyMax }, { id: 'h2', energyMax }]);
    const preRate = 0.7;
    const postRate = 0.85; // not an integer multiple of preRate — a genuine change, not a skip
    const preDelta = (preRate * INTERVAL_MS) / 1000;
    const postDelta = (postRate * INTERVAL_MS) / 1000;
    const POST_TICKS = 4;

    const preEnergies = steppedDrain(WARM_UP_TICKS + 1, 900, preDelta);
    const postStart = preEnergies[preEnergies.length - 1]! - postDelta;
    const postEnergies = steppedDrain(POST_TICKS, postStart, postDelta);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    for (let i = 0; i < preEnergies.length; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([
          { id: 'carrier', energyFraction: energyAt(900, 0.6, atMs) / energyMax },
          { id: 'h2', energyFraction: preEnergies[i]! / energyMax },
        ]),
        rotation,
        atMs,
      });
      state = result.state;
      if (i === preEnergies.length - 1) expect(result.field.find((c) => c.heroId === 'h2')?.basis).toBe('observed');
    }

    const bases: string[] = [];
    const rates: number[] = [];
    for (let i = 0; i < postEnergies.length; i += 1) {
      const atMs = (preEnergies.length + i) * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h2', energyFraction: postEnergies[i]! / energyMax }]),
        rotation,
        atMs,
      });
      state = result.state;
      const reading = result.field.find((c) => c.heroId === 'h2')!;
      bases.push(reading.basis);
      rates.push(reading.drainPerSecond);
    }

    expect(bases.every((basis) => basis === 'observed')).toBe(true);
    // The very first post-departure reading already reports the new rate — no intermediate
    // value ever appears, proving there is no multi-tick blend easing toward it.
    expect(rates[0]).toBeCloseTo(postRate, 6);
    expect(new Set(rates.map((rate) => rate.toFixed(6))).size).toBe(1);
  });

  it("a hero gaining drain reduction slows its own countdown on the very next frame, with no multi-tick easing", () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);
    const preRate = 0.8;
    const postRate = 0.65; // not an integer multiple of preRate — a genuine change, not a skip
    const preDelta = (preRate * INTERVAL_MS) / 1000;
    const postDelta = (postRate * INTERVAL_MS) / 1000;
    const POST_TICKS = 4;

    const preEnergies = steppedDrain(WARM_UP_TICKS + 1, 900, preDelta);
    const postStart = preEnergies[preEnergies.length - 1]! - postDelta;
    const postEnergies = steppedDrain(POST_TICKS, postStart, postDelta);

    let state: FieldCountdownState = createInitialFieldCountdownState();
    for (let i = 0; i < preEnergies.length; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: preEnergies[i]! / energyMax }]),
        rotation,
        atMs,
      });
      state = result.state;
      if (i === preEnergies.length - 1) expect(result.field[0]!.basis).toBe('observed');
    }

    const bases: string[] = [];
    const rates: number[] = [];
    for (let i = 0; i < postEnergies.length; i += 1) {
      const atMs = (preEnergies.length + i) * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: postEnergies[i]! / energyMax }]),
        rotation,
        atMs,
      });
      state = result.state;
      bases.push(result.field[0]!.basis);
      rates.push(result.field[0]!.drainPerSecond);
    }

    expect(bases.every((basis) => basis === 'observed')).toBe(true);
    expect(rates[0]).toBeCloseTo(postRate, 6);
    expect(new Set(rates.map((rate) => rate.toFixed(6))).size).toBe(1);
  });
});

describe('ingestFieldCountdownTick — jitter in arrival timing never moves the per-hero countdown', () => {
  it('feeding the same energy series through two different, noisy arrival-timestamp sequences reports the same frames-remaining figure', () => {
    const energyMax = 1000;
    const rotation = rotationOf([{ id: 'h', energyMax }]);
    const deltaPerFrame = 0.24; // 0.8/s at the true INTERVAL_MS=300ms cadence, inside the valid rate range
    const TICKS = WARM_UP_TICKS + 6;
    const energies = Array.from({ length: TICKS }, (_, i) => 900 - i * deltaPerFrame);

    function replay(atMsFor: (i: number) => number): { readonly secondsRemaining: number; readonly drainPerSecond: number } {
      let state: FieldCountdownState = createInitialFieldCountdownState();
      let last: { secondsRemaining: number; drainPerSecond: number } | undefined;
      for (let i = 0; i < TICKS; i += 1) {
        const result = ingestFieldCountdownTick(state, {
          tick: tick([{ id: 'h', energyFraction: energies[i]! / energyMax }]),
          rotation,
          atMs: atMsFor(i),
        });
        state = result.state;
        const reading = result.field[0];
        // Only the FIRST observed reading: the never-rise clamp compares against a hero's
        // previously displayed value, which would fold the clock's own (expected, shared)
        // jitter into a later comparison and defeat the point of this test. The first observed
        // reading has no prior displayed value to clamp against.
        if (last === undefined && reading?.basis === 'observed') {
          last = { secondsRemaining: reading.secondsRemaining, drainPerSecond: reading.drainPerSecond };
        }
      }
      if (last === undefined) throw new Error('never reached observed — test setup is wrong');
      return last;
    }

    const steady = replay((i) => i * INTERVAL_MS);
    const jittered = replay((i) => i * INTERVAL_MS + (i % 2 === 0 ? 37 : -41));

    // secondsRemaining = framesRemaining * secondsPerFrame and drainPerSecond = deltaPerFrame /
    // secondsPerFrame, so their product cancels the (jitter-sensitive) secondsPerFrame term and
    // leaves exactly framesRemaining * deltaPerFrame — a quantity jitter cannot touch since it
    // never enters the per-hero computation at all.
    const framesRemainingProxy = (reading: { secondsRemaining: number; drainPerSecond: number }) =>
      reading.secondsRemaining * reading.drainPerSecond;

    expect(framesRemainingProxy(jittered)).toBeCloseTo(framesRemainingProxy(steady), 6);
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

  it('decreases every observed hero countdown by exactly the same amount every frame — no stutter, no step', () => {
    // The tap wire never carries energyMax (see LiveTickHero) — it comes from the rotation
    // projection instead, which this fixture has none of. Each hero gets a synthetic energyMax
    // chosen so its own real per-frame fractional drop lands on TARGET_RATE_PER_SECOND: the
    // absolute scale is arbitrary and does not affect whether the per-frame drop stays constant,
    // only whether the resulting rate falls inside the sanity range every real drain rate does.
    const FRAME_INTERVAL_MS = 100; // the tap's own ~10 Hz cadence
    const TARGET_RATE_PER_SECOND = 0.8;
    const energyMaxByHero = new Map(
      heroIds.map((id) => {
        const series = fixture.energyFractionByHeroId[id]!;
        const perFrameFractionDrop = series[0]! - series[1]!;
        const energyMax = TARGET_RATE_PER_SECOND / (perFrameFractionDrop * (1000 / FRAME_INTERVAL_MS));
        return [id, energyMax] as const;
      }),
    );
    const rotation = rotationOf(heroIds.map((id) => ({ id, energyMax: energyMaxByHero.get(id)! })));

    let state: FieldCountdownState = createInitialFieldCountdownState();
    const secondsRemainingByHero = new Map<string, number[]>(heroIds.map((id) => [id, []]));
    const basisByHero = new Map<string, string[]>(heroIds.map((id) => [id, []]));

    for (let i = 0; i < fixture.tickCount; i += 1) {
      const atMs = i * FRAME_INTERVAL_MS;
      const heroes = heroIds.map((id) => ({ id, energyFraction: fixture.energyFractionByHeroId[id]![i]! }));
      const result = ingestFieldCountdownTick(state, { tick: tick(heroes), rotation, atMs });
      state = result.state;
      for (const heroId of heroIds) {
        const reading = result.field.find((c) => c.heroId === heroId);
        if (reading === undefined) continue;
        secondsRemainingByHero.get(heroId)!.push(reading.secondsRemaining);
        basisByHero.get(heroId)!.push(reading.basis);
      }
    }

    for (const heroId of heroIds) {
      const bases = basisByHero.get(heroId)!;
      const readings = secondsRemainingByHero.get(heroId)!;
      const firstObservedIndex = bases.indexOf('observed');
      expect(firstObservedIndex).toBeGreaterThanOrEqual(0);
      // Once observed, it stays observed for the rest of the real capture — the clock this
      // rework introduces never loses trust once earned, on real data.
      expect(bases.slice(firstObservedIndex).every((basis) => basis === 'observed')).toBe(true);

      const observedReadings = readings.slice(firstObservedIndex);
      const diffs = observedReadings.slice(1).map((value, i) => observedReadings[i]! - value);
      for (const diff of diffs) expect(diff).toBeCloseTo(diffs[0]!, 9);
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

    for (let i = 0; i < WARM_UP_TICKS + 1; i += 1) {
      const atMs = i * INTERVAL_MS;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: energyAt(900, 0.8, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers,
      });
      state = result.state;
      if (i === WARM_UP_TICKS) beforeRecharge = result.field[0]!.secondsRemaining;
    }

    const rechargeAtMs = (WARM_UP_TICKS + 1) * INTERVAL_MS;
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
    let lastAtMs = 0;
    for (let i = 0; i < WARM_UP_TICKS; i += 1) {
      const atMs = i * INTERVAL_MS;
      lastAtMs = atMs;
      const result = ingestFieldCountdownTick(state, {
        tick: tick([{ id: 'h', energyFraction: energyAt(900, 0.8, atMs) / energyMax }]),
        rotation,
        atMs,
        modelledDrainMultipliers: new Map([['h', { selfDrainMult: 0.8, teamDrainMult: 1 }]]),
      });
      state = result.state;
      if (i === WARM_UP_TICKS - 1) beforeChangeRemaining = result.field[0]!.secondsRemaining;
    }

    const pinnedEnergy = energyAt(900, 0.8, lastAtMs);

    // The multipliers now imply a much slower rate (DRAIN_RATE_FLOOR, 0.6/s — both terms at
    // their reduction cap) while the reported energy is pinned at its prior value: without the
    // clamp, dividing an unchanged energy by a falling rate reads as more remaining time even
    // though the hero's own energy hasn't moved. Pinned (flat) energy also means the hero's own
    // delta clock reports no rate known, so every reading here is the modelled fallback.
    let maxRemainingAfterChange = 0;
    for (let i = 0; i < 7; i += 1) {
      const atMs = lastAtMs + (i + 1) * INTERVAL_MS;
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
