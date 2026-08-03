import { describe, expect, it } from 'vitest';
import { heroPowerIndex } from '@bombfarm/domain/power';
import { normalizeHero } from '@/shared/lib/storage';
import { emptySheet } from '@bombfarm/domain/gear';

describe('heroPowerIndex', () => {
  it('ranks a higher-attack hero above a lower-attack one', () => {
    const strong = normalizeHero({
      id: 'a',
      name: 'Strong',
      gearedOverride: { ...emptySheet(), attack: 2000, critChance: 20, critDmg: 100, cdr: 20 },
    });
    const weak = normalizeHero({
      id: 'b',
      name: 'Weak',
      gearedOverride: { ...emptySheet(), attack: 200, critChance: 5, critDmg: 50, cdr: 1 },
    });
    expect(heroPowerIndex(strong)).toBeGreaterThan(heroPowerIndex(weak));
  });

  it('migrates legacy heroes by computing geared from naked + gear when unset', () => {
    const h = normalizeHero({
      id: 'c',
      name: 'Naked',
      naked: { ...emptySheet(), attack: 100, critChance: 5, critDmg: 50, cdr: 1 },
    });
    expect(heroPowerIndex(h)).toBeGreaterThan(0);
  });
});
