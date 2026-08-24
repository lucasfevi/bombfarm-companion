import { describe, expect, it } from 'vitest';
import { HERO_SKIN_COUNT, heroAvatarSrc, isKnownSkin, normalizeSkin, propIconSrc, goldIconSrc, clockIconSrc } from '../src/wiki-assets';
import { PROPS } from '../src/phases';

describe('heroAvatarSrc display map', () => {
  it('maps save skin 1/2 to swapped wiki hero3/hero2 files', () => {
    expect(heroAvatarSrc(0)).toBe('/wiki-assets/hero/hero1_avatar.png');
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero2_avatar.png');
    expect(heroAvatarSrc(3)).toBe('/wiki-assets/hero/hero4_avatar.png');
    expect(heroAvatarSrc(6)).toBe('/wiki-assets/hero/hero7_avatar.png');
  });

  // PROVISIONAL: skins 7 and 8 → files 8 and 9 are inferred from `file = index + 1` holding for
  // indices 3..6, not confirmed against an in-game save carrying either. The hero2/hero3 swap at
  // the front of the table is standing proof that wiki numbering CAN diverge from the in-game
  // index, so if a real save ever contradicts this, fix `SKIN_AVATAR_FILE` — not the test.
  it('maps the last two skins to their own files instead of falling back to skin 1', () => {
    expect(HERO_SKIN_COUNT).toBe(9);
    expect(heroAvatarSrc(7)).toBe('/wiki-assets/hero/hero8_avatar.png');
    expect(heroAvatarSrc(8)).toBe('/wiki-assets/hero/hero9_avatar.png');
    // The bug: an index past the table's end hit `?? 1` and rendered skin 1's face.
    expect(heroAvatarSrc(7)).not.toBe(heroAvatarSrc(0));
    expect(heroAvatarSrc(8)).not.toBe(heroAvatarSrc(0));
  });

  it('clamps unknown skins without rewriting 1↔2', () => {
    expect(normalizeSkin(1)).toBe(1);
    expect(normalizeSkin(2)).toBe(2);
    expect(normalizeSkin(-1)).toBe(0);
    expect(normalizeSkin(7)).toBe(7);
    expect(normalizeSkin(HERO_SKIN_COUNT + 8)).toBe(HERO_SKIN_COUNT - 1);
  });

  it('moves the known-skin boundary to 8', () => {
    expect(isKnownSkin(7)).toBe(true);
    expect(isKnownSkin(8)).toBe(true);
    expect(isKnownSkin(9)).toBe(false);
  });
});

describe('nav chrome', () => {
  it('points at the bundled gold coin chrome', () => {
    expect(goldIconSrc()).toBe('/wiki-assets/nav/icon_gold.png');
  });

  it('points at the bundled gate-timer clock chrome', () => {
    expect(clockIconSrc()).toBe('/wiki-assets/icons/icon_clock.png');
  });
});

describe('propIconSrc', () => {
  it('builds env art paths from the prop name', () => {
    expect(propIconSrc('gold_ore')).toBe('/wiki-assets/env/gold_ore.png');
    expect(propIconSrc('minerio_mithril')).toBe('/wiki-assets/env/minerio_mithril.png');
  });

  it('returns null for an absent name instead of a `/env/.png` path', () => {
    expect(propIconSrc('')).toBeNull();
    expect(propIconSrc(undefined as unknown as string)).toBeNull();
  });

  /**
   * The helper is a pure string join, so a prop whose art is not bundled still yields a
   * plausible-looking path — the failure is a broken <img> at runtime, invisible to type
   * checking. The on-disk half of this guard (every `PROPS[].name` resolves to a file that
   * exists under `apps/web/public/wiki-assets/env/`) lives with its three siblings for
   * abilities, items and hero art in `apps/web/src/tests/game-art-chrome.test.ts`, which is
   * the package that owns `public/`. This side asserts only what the domain can see: that
   * every modeled prop produces a resolvable path with no separator or casing surprises.
   */
  it('resolves every modeled prop to a distinct env path', () => {
    expect(PROPS.length, 'modeled props').toBe(10);

    const seen = new Set<string>();
    for (const prop of PROPS) {
      const src = propIconSrc(prop.name);
      expect(src, `propIconSrc(${prop.name})`).toBe(`/wiki-assets/env/${prop.name}.png`);
      expect(prop.name, 'prop name is a bare art slug').toMatch(/^[a-z0-9_]+$/);
      expect(seen.has(src!), `${prop.name} reuses ${src}`).toBe(false);
      seen.add(src!);
    }
  });
});
