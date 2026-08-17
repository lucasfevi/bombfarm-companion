import { describe, expect, it } from 'vitest';
import { HERO_SKIN_COUNT, heroAvatarSrc, isKnownSkin, normalizeSkin } from '../src/wiki-assets';

describe('heroAvatarSrc display map', () => {
  it('maps save skin 1/2 to swapped wiki hero3/hero2 files', () => {
    expect(heroAvatarSrc(0)).toBe('/wiki-assets/hero/hero1_avatar.png');
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero2_avatar.png');
    expect(heroAvatarSrc(3)).toBe('/wiki-assets/hero/hero4_avatar.png');
    expect(heroAvatarSrc(6)).toBe('/wiki-assets/hero/hero7_avatar.png');
  });

  // PROVISIONAL: skin 7 → file 8 is inferred from `file = index + 1` holding for indices 3..6,
  // not confirmed against an in-game save carrying `skin: 7`. The hero2/hero3 swap at the front
  // of the table is standing proof that wiki numbering CAN diverge from the in-game index, so if
  // a real skin-7 save ever contradicts this, fix `SKIN_AVATAR_FILE` — do not "fix" the test.
  it('maps the 8th skin to its own file instead of falling back to skin 1', () => {
    expect(HERO_SKIN_COUNT).toBe(8);
    expect(heroAvatarSrc(7)).toBe('/wiki-assets/hero/hero8_avatar.png');
    // The bug: 7 fell off the end of the table, hit `?? 1`, and rendered skin 1's face.
    expect(heroAvatarSrc(7)).not.toBe(heroAvatarSrc(0));
  });

  it('clamps unknown skins without rewriting 1↔2', () => {
    expect(normalizeSkin(1)).toBe(1);
    expect(normalizeSkin(2)).toBe(2);
    expect(normalizeSkin(-1)).toBe(0);
    expect(normalizeSkin(7)).toBe(7);
    expect(normalizeSkin(HERO_SKIN_COUNT + 8)).toBe(HERO_SKIN_COUNT - 1);
  });

  it('moves the known-skin boundary to 7', () => {
    expect(isKnownSkin(6)).toBe(true);
    expect(isKnownSkin(7)).toBe(true);
    expect(isKnownSkin(8)).toBe(false);
  });
});
