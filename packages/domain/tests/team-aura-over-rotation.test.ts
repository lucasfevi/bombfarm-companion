import { describe, expect, it } from 'vitest';
import { ABILITIES } from '@bombfarm/domain/model';
import {
  APPRENTICE_XP_CAP,
  APPRENTICE_XP_PER_RANK,
  apprenticeXpMult,
  teamAuraOverRotation,
} from '@bombfarm/domain/team-buffs';

describe('teamAuraOverRotation', () => {
  it('is the plain weighted sum while every carrier together stays under the cap', () => {
    const total = teamAuraOverRotation(
      [
        { value: 0.05, presence: 0.5 },
        { value: 0.04, presence: 1 },
      ],
      0.15,
    );
    expect(total).toBeCloseTo(0.065, 12);
  });

  it('takes the cap inside the expectation once the carriers can exceed it', () => {
    const total = teamAuraOverRotation(
      [
        { value: 0.15, presence: 0.5 },
        { value: 0.15, presence: 0.5 },
      ],
      0.15,
    );
    expect(total).toBeCloseTo(0.15 * 0.75, 12);
  });

  it('ignores carriers with no value, no presence or a non-finite presence', () => {
    const total = teamAuraOverRotation(
      [
        { value: 0, presence: 1 },
        { value: 0.1, presence: 0 },
        { value: 0.1, presence: Number.NaN },
        { value: 0.1, presence: Number.POSITIVE_INFINITY },
      ],
      0.15,
    );
    expect(total).toBe(0);
  });

  it('clamps a presence above 1 to the whole run', () => {
    expect(teamAuraOverRotation([{ value: 0.1, presence: 3 }], 0.15)).toBeCloseTo(0.1, 12);
  });

  it('falls back to the capped weighted sum past the enumeration limit', () => {
    const carriers = Array.from({ length: 21 }, () => ({ value: 0.01, presence: 0.5 }));
    expect(teamAuraOverRotation(carriers, 0.15)).toBeCloseTo(Math.min(0.15, 21 * 0.01 * 0.5), 12);
  });
});

describe('apprenticeXpMult', () => {
  it('reads its per-rank add from the ability catalog', () => {
    const apprentice = ABILITIES.find((ability) => ability.id === 'aprendiz');
    expect(apprentice?.effect).toEqual({ kind: 'teamXpPct', perLevel: APPRENTICE_XP_PER_RANK * 100 });
  });

  it('clamps a rank outside 0..max before pricing it', () => {
    expect(apprenticeXpMult([{ rank: 99, presence: 1 }])).toBeCloseTo(1 + APPRENTICE_XP_CAP, 12);
    expect(apprenticeXpMult([{ rank: -5, presence: 1 }])).toBe(1);
  });

  it('is ×1 with no carrier', () => {
    expect(apprenticeXpMult([])).toBe(1);
  });
});
