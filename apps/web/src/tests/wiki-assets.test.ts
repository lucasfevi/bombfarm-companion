import { describe, expect, it } from 'vitest';
import { normalizeHero } from '@/shared/lib/storage';
import { heroAvatarSrc, itemIconSrc, normalizeSkin, rarityCrystalSrc, abilityIconSrc, goldIconSrc } from '@bombfarm/domain/wiki-assets';

describe('wiki-assets', () => {
  it('maps save skin to bundled avatar paths', () => {
    expect(heroAvatarSrc(0)).toBe('/wiki-assets/hero/hero1_avatar.png');
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero2_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(3)).toBe('/wiki-assets/hero/hero4_avatar.png');
    expect(heroAvatarSrc(4)).toBe('/wiki-assets/hero/hero5_avatar.png');
    expect(heroAvatarSrc(5)).toBe('/wiki-assets/hero/hero6_avatar.png');
    expect(heroAvatarSrc(6)).toBe('/wiki-assets/hero/hero7_avatar.png');
  });

  it('clamps skin to 0..(HERO_SKIN_COUNT-1)', () => {
    expect(normalizeSkin(-1)).toBe(0);
    expect(normalizeSkin(5)).toBe(5);
    expect(normalizeSkin(6.4)).toBe(6);
    expect(normalizeSkin(99)).toBe(6);
    expect(normalizeSkin('x')).toBe(0);
  });

  it('builds item icon paths from catalog defs', () => {
    expect(itemIconSrc('clay_luva')).toBe('/wiki-assets/items/lvl40_gloves_clay.png');
    expect(itemIconSrc('unknown_x')).toBeNull();
  });

  it('maps rarity crystals (no common overlay)', () => {
    expect(rarityCrystalSrc(0)).toBeNull();
    expect(rarityCrystalSrc(2)).toBe('/wiki-assets/icons/crystal_rare.png');
    expect(rarityCrystalSrc(5)).toBe('/wiki-assets/icons/crystal_mythic.png');
  });

  it('builds ability icon paths from ability id', () => {
    expect(abilityIconSrc('ponta_diamante')).toBe('/wiki-assets/abilities/ponta_diamante.png');
    expect(abilityIconSrc('')).toBeNull();
  });

  it('points at the bundled gold coin chrome', () => {
    expect(goldIconSrc()).toBe('/wiki-assets/nav/icon_gold.png');
  });
});

describe('normalizeHero skin', () => {
  it('defaults skin to 0 and preserves imported value', () => {
    expect(normalizeHero({ id: 'a', name: 'A' }).skin).toBe(0);
    expect(normalizeHero({ id: 'b', name: 'B', skin: 3 }).skin).toBe(3);
    expect(normalizeHero({ id: 'c', name: 'C', skin: 5 }).skin).toBe(5);
  });
});
