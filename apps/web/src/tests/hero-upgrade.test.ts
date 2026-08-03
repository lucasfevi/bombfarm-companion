import { describe, expect, it } from 'vitest';
import {
  applyGear,
  canLevelUp,
  canStarUp,
  emptyLoadout,
  emptySheetOther,
  nextLevelStep,
  nextStarsStep,
  rescaleHeroForLevel,
  rescaleHeroForStars,
  type EquippedItem,
  type Loadout,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { STRINGS } from '@/shared/i18n';

const naked = (): SheetStats => ({
  attack: 200,
  energy: 300,
  speed: 50,
  critChance: 10,
  critDmg: 70,
  penetration: 5,
  cdr: 5,
  luck: 20,
});

function weaponLoadout(): Loadout {
  const loadout = emptyLoadout();
  loadout.arma = {
    defId: 'clay_arma',
    rarityIdx: 2,
    level: 40,
    upgrade: 10,
  } satisfies EquippedItem;
  return loadout;
}

describe('canLevelUp / canStarUp (CTA-03)', () => {
  it('disables Level-up at max level 100', () => {
    expect(canLevelUp(99)).toBe(true);
    expect(canLevelUp(100)).toBe(false);
    expect(nextLevelStep(100)).toBe(100);
  });

  it('disables Star-upgrade at max stars 3', () => {
    expect(canStarUp(2)).toBe(true);
    expect(canStarUp(3)).toBe(false);
    expect(nextStarsStep(3)).toBe(3);
  });
});

describe('CTA +1 shares rescale path with stepper (CTA-01/02/04)', () => {
  it('Level-up +1 equals stepper target level+1 for naked and geared', () => {
    const loadout = weaponLoadout();
    const other = emptySheetOther();
    const n0 = naked();
    const geared = applyGear(n0, loadout, other);
    const from = 10;
    const viaStepper = rescaleHeroForLevel(n0, geared, loadout, other, from, from + 1);
    const viaCta = rescaleHeroForLevel(n0, geared, loadout, other, from, nextLevelStep(from));
    expect(viaCta).toEqual(viaStepper);
    expect(viaCta.naked.attack).toBeGreaterThan(n0.attack);
  });

  it('Star-upgrade +1 equals stepper target stars+1 for naked and geared', () => {
    const loadout = weaponLoadout();
    const other = emptySheetOther();
    const n0 = naked();
    const geared = applyGear(n0, loadout, other);
    const from = 0;
    const viaStepper = rescaleHeroForStars(n0, geared, loadout, other, from, from + 1);
    const viaCta = rescaleHeroForStars(n0, geared, loadout, other, from, nextStarsStep(from));
    expect(viaCta).toEqual(viaStepper);
    expect(viaCta.naked.energy).toBeCloseTo(n0.energy * 1.5, 8);
  });

  it('at max, next step is a no-op target (CTA-03 no thrash)', () => {
    const loadout = weaponLoadout();
    const other = emptySheetOther();
    const n0 = naked();
    const geared = applyGear(n0, loadout, other);
    const atMaxLv = rescaleHeroForLevel(n0, geared, loadout, other, 100, nextLevelStep(100));
    expect(atMaxLv.naked).toBe(n0);
    expect(atMaxLv.geared).toBe(geared);
    const atMaxStars = rescaleHeroForStars(n0, geared, loadout, other, 3, nextStarsStep(3));
    expect(atMaxStars.naked).toBe(n0);
    expect(atMaxStars.geared).toBe(geared);
  });
});

describe('CTA chrome labels (EN/PT)', () => {
  it('exposes Level-up / Star-upgrade chrome in both languages', () => {
    expect(STRINGS.en.levelUp).toBe('Level up');
    expect(STRINGS.en.starUpgrade).toBe('Star upgrade');
    expect(STRINGS.pt.levelUp).toBe('Subir nível');
    expect(STRINGS.pt.starUpgrade).toBe('Subir estrela');
  });
});
