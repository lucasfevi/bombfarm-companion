import { describe, expect, it } from 'vitest';
import {
  HOUSES,
  HOUSE_MAX_LEVEL,
  houseRestSeconds,
  PASSAGEM_BASTAO_CAP,
  PASSAGEM_BASTAO_COOLDOWN_SEC,
  PASSAGEM_BASTAO_PER_RANK,
  PASSAGEM_BASTAO_WINDOW_SEC,
  passagemBastaoFieldPulse,
  passagemBastaoPresence,
} from '@bombfarm/domain/model';

describe('passagemBastaoPresence — the share of wall clock one carrier keeps the field lit', () => {
  it('exports the per-rank bonus, the window, the cooldown and the cap', () => {
    expect(PASSAGEM_BASTAO_PER_RANK).toBe(0.04);
    expect(PASSAGEM_BASTAO_WINDOW_SEC).toBe(120);
    expect(PASSAGEM_BASTAO_COOLDOWN_SEC).toBe(600);
    expect(PASSAGEM_BASTAO_CAP).toBe(0.8);
  });

  it('is 0 without field time, finite or otherwise', () => {
    for (const fieldSecondsValue of [0, -5, NaN, Infinity]) {
      expect(passagemBastaoPresence(fieldSecondsValue, 0.1)).toBe(0);
    }
  });

  it('throws rather than guessing when duty cannot give a rotation cycle', () => {
    expect(() => passagemBastaoPresence(60, 0)).toThrow(RangeError);
    expect(() => passagemBastaoPresence(60, 1.5)).toThrow(RangeError);
    expect(() => passagemBastaoPresence(60, NaN)).toThrow(RangeError);
    // Domain tests are not typechecked, so a call site left at one argument has to fail loudly
    // instead of silently pricing a pulse with no cycle behind it.
    expect(() => (passagemBastaoPresence as unknown as (f: number) => number)(60)).toThrow(RangeError);
  });

  it('is the window over the rotation cycle: 120 s of every F / duty seconds', () => {
    // F = 60 s on field, duty 0.1 → a 600 s cycle: lit for 120 of every 600 s.
    expect(passagemBastaoPresence(60, 0.1)).toBeCloseTo(0.2, 12);
    // F = 240 s, duty 0.4 → the same 600 s cycle, the same share: the stint is not the window.
    expect(passagemBastaoPresence(240, 0.4)).toBeCloseTo(0.2, 12);
    // A 1729 s cycle (the phase-51 anchor's carrier) is lit 6.9% of the time.
    expect(passagemBastaoPresence(888.9, 888.9 / 1729)).toBeCloseTo(120 / 1729, 6);
  });

  it('halves when the carrier re-enters twice per cooldown', () => {
    // A 300 s cycle would be lit 40% of the time if every entry pulsed; only every other one does.
    expect(passagemBastaoPresence(120, 0.4)).toBeCloseTo(0.2, 12);
  });

  it('never exceeds 1', () => {
    expect(passagemBastaoPresence(10, 0.5)).toBeLessThanOrEqual(1);
  });
});

describe('the pulse cooldown cannot bind while the House stays this slow', () => {
  // The whole reason the cooldown term reads as dead code. A hero re-enters the field once per
  // (field seconds + one House recovery), so the cooldown only starts costing pulses once some
  // House recovers faster than it. Today none does, and this is the assertion that notices when
  // one finally does — at which point the term stops being inert and someone owes this model a
  // second look.
  const fastestRest = Math.min(...HOUSES.map((_, index) => houseRestSeconds(index, HOUSE_MAX_LEVEL)));

  it('the fastest House in the game recovers no faster than the pulse cooldown', () => {
    expect(fastestRest).toBe(600);
    expect(fastestRest).toBeGreaterThanOrEqual(PASSAGEM_BASTAO_COOLDOWN_SEC);
  });

  it('so every reachable carrier pulses on every entry, whatever their energy', () => {
    for (const fieldSecondsValue of [1, 30, 120, 400, 1200]) {
      const cycle = fieldSecondsValue + fastestRest;
      const duty = fieldSecondsValue / cycle;
      expect(passagemBastaoPresence(fieldSecondsValue, duty)).toBeCloseTo(PASSAGEM_BASTAO_WINDOW_SEC / cycle, 12);
    }
  });
});

describe('passagemBastaoFieldPulse — priced like the other team auras', () => {
  it('is the one ×1 level with no carrier, and with carriers that never pulse', () => {
    expect(passagemBastaoFieldPulse([])).toEqual({ levels: [{ mult: 1, probability: 1 }], expectedMult: 1 });
    expect(passagemBastaoFieldPulse([{ rank: 20, presence: 0 }, { rank: 0, presence: 0.5 }])).toEqual({
      levels: [{ mult: 1, probability: 1 }],
      expectedMult: 1,
    });
  });

  it('one carrier is two levels: ×1 off, ×(1 + 0.04 × rank) on, for its own share of wall clock', () => {
    const pulse = passagemBastaoFieldPulse([{ rank: 20, presence: 0.2 }]);
    expect(pulse.levels).toEqual([
      { mult: 1, probability: 0.8 },
      { mult: 1.8, probability: 0.2 },
    ]);
    expect(pulse.expectedMult).toBeCloseTo(1.16, 12);
  });

  it('overlapping pulses sum their ranks, assuming independent carriers', () => {
    const pulse = passagemBastaoFieldPulse([
      { rank: 5, presence: 0.5 },
      { rank: 10, presence: 0.2 },
    ]);
    expect(pulse.levels.map((level) => [level.mult, level.probability])).toEqual([
      [1, 0.5 * 0.8],
      [1.2, 0.5 * 0.8],
      [1.4, 0.5 * 0.2],
      [1.6, 0.5 * 0.2],
    ]);
    expect(pulse.levels.reduce((sum, level) => sum + level.probability, 0)).toBeCloseTo(1, 12);
    expect(pulse.expectedMult).toBeCloseTo(1 + 0.04 * (5 * 0.5 + 10 * 0.2), 12);
  });

  it('the cap is taken INSIDE the expectation — two rank-20 carriers never read as one permanent one', () => {
    const pulse = passagemBastaoFieldPulse([
      { rank: 20, presence: 0.5 },
      { rank: 20, presence: 0.5 },
    ]);
    // Either up → ×1.8, the cap; both down a quarter of the time.
    expect(pulse.levels).toEqual([
      { mult: 1, probability: 0.25 },
      { mult: 1.8, probability: 0.75 },
    ]);
    expect(pulse.expectedMult).toBeCloseTo(1.6, 12);
    // `min(cap, E[Σ])` would have said 1.8 — the field lit the whole time.
    expect(pulse.expectedMult).toBeLessThan(1 + Math.min(PASSAGEM_BASTAO_CAP, 0.04 * 20));
  });

  it('holds at most 21 levels however many carriers there are', () => {
    const carriers = Array.from({ length: 30 }, (_, index) => ({ rank: (index % 20) + 1, presence: 0.3 }));
    const pulse = passagemBastaoFieldPulse(carriers);
    expect(pulse.levels.length).toBeLessThanOrEqual(21);
    expect(pulse.levels[pulse.levels.length - 1].mult).toBeCloseTo(1 + PASSAGEM_BASTAO_CAP, 12);
    expect(pulse.levels.reduce((sum, level) => sum + level.probability, 0)).toBeCloseTo(1, 12);
  });

  it('levels are ascending, so the first is the floor the field never drops below', () => {
    const pulse = passagemBastaoFieldPulse([
      { rank: 3, presence: 1 },
      { rank: 20, presence: 0.1 },
    ]);
    expect(pulse.levels[0]).toEqual({ mult: 1.12, probability: 0.9 });
  });
});
