import { describe, expect, it } from 'vitest';
import { emptyLoadout, type Loadout } from '@bombfarm/domain/gear';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  NO_GEAR_CLONES,
  clearGearClone,
  copyGearClone,
  heroWithGearClone,
  patchGearClone,
} from './hero-gear-clone';

const equipped: Loadout = {
  ...emptyLoadout(),
  arma: { defId: 'crimson_arma', rarityIdx: 2, level: 40, upgrade: 3 },
};

describe('copying the current gear into a clone', () => {
  it('stores a deep copy, so editing the clone never touches the current gear', () => {
    const clones = copyGearClone(NO_GEAR_CLONES, 'h1', equipped);
    expect(clones.h1).toEqual(equipped);
    expect(clones.h1).not.toBe(equipped);
    expect(clones.h1?.arma).not.toBe(equipped.arma);
  });

  it('re-copying replaces an edited clone with the current gear again', () => {
    const edited = patchGearClone(copyGearClone(NO_GEAR_CLONES, 'h1', equipped), 'h1', 'arma', null);
    expect(edited.h1?.arma).toBeNull();
    expect(copyGearClone(edited, 'h1', equipped).h1).toEqual(equipped);
  });

  it('keeps one clone per hero', () => {
    const clones = copyGearClone(copyGearClone(NO_GEAR_CLONES, 'h1', equipped), 'h2', emptyLoadout());
    expect(clones.h1).toEqual(equipped);
    expect(clones.h2).toEqual(emptyLoadout());
  });
});

describe('editing a clone slot', () => {
  it('patches the clone and leaves the source loadout alone', () => {
    const clones = patchGearClone(copyGearClone(NO_GEAR_CLONES, 'h1', equipped), 'h1', 'arma', { upgrade: 7 });
    expect(clones.h1?.arma?.upgrade).toBe(7);
    expect(equipped.arma?.upgrade).toBe(3);
  });

  it('clears a slot when the patch is null', () => {
    const clones = patchGearClone(copyGearClone(NO_GEAR_CLONES, 'h1', equipped), 'h1', 'arma', null);
    expect(clones.h1?.arma).toBeNull();
  });

  it('does nothing for a hero with no clone', () => {
    expect(patchGearClone(NO_GEAR_CLONES, 'h1', 'arma', { upgrade: 7 })).toBe(NO_GEAR_CLONES);
  });
});

describe('clearing a clone', () => {
  it('removes only that hero clone', () => {
    const both = copyGearClone(copyGearClone(NO_GEAR_CLONES, 'h1', equipped), 'h2', equipped);
    const cleared = clearGearClone(both, 'h1');
    expect(Object.keys(cleared)).toEqual(['h2']);
  });

  it('is a no-op for a hero with no clone', () => {
    expect(clearGearClone(NO_GEAR_CLONES, 'h1')).toBe(NO_GEAR_CLONES);
  });
});

describe('heroWithGearClone', () => {
  const hero = { id: 'h1', altLoadout: null } as unknown as HeroRecord;

  it('hands the pipeline the clone as the hero alt loadout', () => {
    const clones = copyGearClone(NO_GEAR_CLONES, 'h1', equipped);
    expect(heroWithGearClone(hero, clones).altLoadout).toBe(clones.h1);
  });

  it('returns the same hero when it has no clone', () => {
    expect(heroWithGearClone(hero, NO_GEAR_CLONES)).toBe(hero);
  });
});
