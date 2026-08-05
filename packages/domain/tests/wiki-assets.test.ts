import { describe, expect, it } from 'vitest';
import { HERO_SKIN_COUNT, heroAvatarSrc, normalizeSkin } from '../src/wiki-assets';

describe('heroAvatarSrc display map', () => {
  it('maps save skin 1/2 to swapped wiki hero3/hero2 files', () => {
    expect(heroAvatarSrc(0)).toBe('/wiki-assets/hero/hero1_avatar.png');
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero2_avatar.png');
    expect(heroAvatarSrc(3)).toBe('/wiki-assets/hero/hero4_avatar.png');
    expect(heroAvatarSrc(6)).toBe('/wiki-assets/hero/hero7_avatar.png');
  });

  it('clamps unknown skins without rewriting 1↔2', () => {
    expect(normalizeSkin(1)).toBe(1);
    expect(normalizeSkin(2)).toBe(2);
    expect(normalizeSkin(-1)).toBe(0);
    expect(normalizeSkin(HERO_SKIN_COUNT + 8)).toBe(HERO_SKIN_COUNT - 1);
  });
});
