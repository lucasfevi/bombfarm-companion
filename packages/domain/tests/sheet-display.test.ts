import { describe, expect, it } from 'vitest';
import { sheetsClose } from '@bombfarm/domain/sheet-display';
import type { SheetStats } from '@bombfarm/domain/gear';

const sample = (): SheetStats => ({
  attack: 100.14,
  energy: 200.06,
  speed: 55.55,
  critChance: 10.04,
  critDmg: 80.09,
  penetration: 5.01,
  cdr: 4.99,
  luck: 12.34,
});

describe('sheetsClose', () => {
  it('returns true when all keys are within 0.05', () => {
    const a = sample();
    const b = { ...a, attack: a.attack + 0.04 };
    expect(sheetsClose(a, b)).toBe(true);
  });

  it('returns false when any key drifts beyond 0.05', () => {
    const a = sample();
    const b = { ...a, cdr: a.cdr + 0.06 };
    expect(sheetsClose(a, b)).toBe(false);
  });
});
