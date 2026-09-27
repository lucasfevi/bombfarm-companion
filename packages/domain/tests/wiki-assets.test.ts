import { describe, expect, it } from 'vitest';
import {
  HERO_SKIN_COUNT,
  chestIconSrc,
  clockIconSrc,
  goldIconSrc,
  heroAvatarSrc,
  heroCageIconSrc,
  isKnownSkin,
  itemKindIconSrc,
  normalizeSkin,
  propIconSrc,
  runeIconSrc,
} from '../src/wiki-assets';
import { PROPS } from '../src/phases';

describe('heroAvatarSrc display map', () => {
  it('maps save skin 1/2 to swapped wiki hero3/hero2 files', () => {
    expect(heroAvatarSrc(0)).toBe('/wiki-assets/hero/hero1_avatar.png');
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero2_avatar.png');
    expect(heroAvatarSrc(3)).toBe('/wiki-assets/hero/hero4_avatar.png');
    expect(heroAvatarSrc(6)).toBe('/wiki-assets/hero/hero7_avatar.png');
  });

  // Past the hero2/hero3 swap the wiki numbers files one ahead of the index; the game client's
  // own skin table agrees for every index, so a real save that contradicts this means the table
  // moved — fix `SKIN_AVATAR_FILE`, not the test.
  it('maps each of the sixteen skins to its own file instead of falling back to skin 1', () => {
    expect(HERO_SKIN_COUNT).toBe(16);
    for (let skin = 3; skin < HERO_SKIN_COUNT; skin += 1) {
      expect(heroAvatarSrc(skin)).toBe(`/wiki-assets/hero/hero${skin + 1}_avatar.png`);
    }
    // The bug: an index past the table's end hit `?? 1` and rendered skin 1's face.
    expect(heroAvatarSrc(15)).not.toBe(heroAvatarSrc(0));
  });

  it('clamps unknown skins without rewriting 1↔2', () => {
    expect(normalizeSkin(1)).toBe(1);
    expect(normalizeSkin(2)).toBe(2);
    expect(normalizeSkin(-1)).toBe(0);
    expect(normalizeSkin(7)).toBe(7);
    expect(normalizeSkin(HERO_SKIN_COUNT + 8)).toBe(HERO_SKIN_COUNT - 1);
  });

  it('moves the known-skin boundary to 15', () => {
    expect(isKnownSkin(9)).toBe(true);
    expect(isKnownSkin(15)).toBe(true);
    expect(isKnownSkin(16)).toBe(false);
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

/**
 * A `chest_hero_{act}` row used to fall through to the item chest's wooden box, which is the
 * art for a different item. The tail is the act the cage was caught in, and the wiki draws that
 * cage per act, so the row shows the cage itself.
 */
describe('itemKindIconSrc for skins and runes', () => {
  it('draws an unpacked skin as the avatar a hero wearing it shows', () => {
    expect(itemKindIconSrc('skin_6', 0)).toBe(heroAvatarSrc(6));
  });

  it('draws nothing for a skin index past the bundled art, rather than another skin face', () => {
    expect(itemKindIconSrc('skin_99', 0)).toBeNull();
  });

  it('draws a rune as its axis sprite at the tier it carries', () => {
    expect(itemKindIconSrc('rune_critdmg_comum', 0)).toBe(runeIconSrc('critdmg', 0));
    expect(itemKindIconSrc('rune_attack_raro', 2)).toBe(runeIconSrc('attack', 2));
  });

  it('draws nothing for an axis the game has not been seen to use', () => {
    expect(itemKindIconSrc('rune_luck_comum', 0)).toBeNull();
  });
});

describe('itemKindIconSrc for a hero cage', () => {
  it.each([1, 2, 3, 4, 5])('draws the act-%i cage, never the item chest', (act) => {
    const src = itemKindIconSrc(`chest_hero_${act}`, act);
    expect(src).toBe(`/wiki-assets/env/cage_ato${act}.png`);
    expect(src).not.toBe(chestIconSrc());
  });

  it('falls back to the generic cage for an act outside the five bands', () => {
    expect(itemKindIconSrc('chest_hero_0', 0)).toBe('/wiki-assets/env/jaula.png');
    expect(heroCageIconSrc(6)).toBe('/wiki-assets/env/jaula.png');
  });
});
