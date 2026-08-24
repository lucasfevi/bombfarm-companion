import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { normalizeHero } from '@/shared/lib/storage';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';
import { HERO_SKIN_COUNT, heroAvatarSrc, isKnownSkin, itemIconSrc, normalizeSkin, rarityCrystalSrc, abilityIconSrc, goldIconSrc, chestIconSrc, clockIconSrc, propIconSrc, dropIconSrc } from '@bombfarm/domain/wiki-assets';
import { DROP_RATES, type DropRateId } from '@bombfarm/domain/phase-wiki';

describe('wiki-assets', () => {
  it('maps save skin to bundled avatar paths', () => {
    expect(heroAvatarSrc(0)).toBe('/wiki-assets/hero/hero1_avatar.png');
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero2_avatar.png');
    expect(heroAvatarSrc(3)).toBe('/wiki-assets/hero/hero4_avatar.png');
    expect(heroAvatarSrc(4)).toBe('/wiki-assets/hero/hero5_avatar.png');
    expect(heroAvatarSrc(5)).toBe('/wiki-assets/hero/hero6_avatar.png');
    expect(heroAvatarSrc(6)).toBe('/wiki-assets/hero/hero7_avatar.png');
    expect(heroAvatarSrc(7)).toBe('/wiki-assets/hero/hero8_avatar.png');
    expect(heroAvatarSrc(8)).toBe('/wiki-assets/hero/hero9_avatar.png');
  });

  it('clamps skin to 0..(HERO_SKIN_COUNT-1)', () => {
    expect(normalizeSkin(-1)).toBe(0);
    expect(normalizeSkin(5)).toBe(5);
    expect(normalizeSkin(6.4)).toBe(6);
    expect(normalizeSkin(8)).toBe(8);
    expect(normalizeSkin(99)).toBe(8);
    expect(normalizeSkin('x')).toBe(0);
  });

  it('treats skin 8 as known and 9 as unknown', () => {
    // The 2026-08-23 patch added a 9th cosmetic ("Sentinela Real"), which the wiki reports as
    // `skins.total: 9`. Before it landed here, a hero wearing it imported as the placeholder.
    expect(HERO_SKIN_COUNT).toBe(9);
    expect(isKnownSkin(8)).toBe(true);
    expect(isKnownSkin(9)).toBe(false);
  });

  /**
   * End-to-end through `parseSaveFile`, not just the predicate: `isKnownSkin` shares the
   * `HERO_SKIN_COUNT` bound, so before a new appearance lands here a save carrying that skin
   * was rejected as out of range and the real value was replaced by the neutral placeholder
   * `0` — the stored value on disk was discarded, not merely mis-rendered. Nothing covered
   * this boundary through the actual import path, which is why the regression was invisible.
   */
  it('keeps a saved skin 8 through import, and still degrades skin 9 to the placeholder', () => {
    const raw = JSON.parse(
      readFileSync(
        join(WEB_PACKAGE_ROOT, '../../packages/domain/tests/fixtures/sheet-math/payload-20260812-8heroes.json'),
        'utf8',
      ),
    ) as { heroes: Record<string, unknown>[] };

    const withSkin = (value: unknown) => {
      const clone = structuredClone(raw);
      clone.heroes[0].skin = value;
      return parseSaveFile(clone, []);
    };

    const skinIssues = (candidate: { issues: string[] }) =>
      candidate.issues.filter((issue) => /unknown skin/i.test(issue));

    const known = withSkin(8).candidates[0];
    expect(known.record.skin).toBe(8);
    expect(skinIssues(known)).toEqual([]);

    // One past the end must NOT clamp to the nearest index (AD-BSP-29) — a nearest-index
    // clamp would render a different hero's face, the exact failure this whole change is about.
    const unknown = withSkin(9).candidates[0];
    expect(unknown.record.skin).toBe(0);
    expect(skinIssues(unknown)).toHaveLength(1);
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

  it('builds prop icon paths from the prop name', () => {
    expect(propIconSrc('bush')).toBe('/wiki-assets/env/bush.png');
    expect(propIconSrc('purple_crystal')).toBe('/wiki-assets/env/purple_crystal.png');
    expect(propIconSrc('')).toBeNull();
  });

  /**
   * Pinned per id at both ends of the difficulty range, because the whole mapping is four
   * separate per-band families plus one fixed sprite, filed under three directories (`key/`,
   * `houses/`, `chests/`) that no other helper reaches. A typo in any one of them is invisible
   * to every other assertion in this file.
   *
   * The difficulty WORD is part of what is pinned. These sprites are renamed on the way in — see
   * `docs/bundled-art-provenance.md` — so a path here is this repo's own name, not upstream's,
   * and nothing outside this helper would catch it drifting back.
   */
  it('maps each drop-chance row to the art of that phase’s difficulty band', () => {
    expect(dropIconSrc('key', 1)).toBe('/wiki-assets/key/key_uncommon.png');
    expect(dropIconSrc('key', 5)).toBe('/wiki-assets/key/key_mythic.png');
    expect(dropIconSrc('time', 1)).toBe('/wiki-assets/houses/house_easy.png');
    expect(dropIconSrc('time', 5)).toBe('/wiki-assets/houses/house_inferno.png');
    expect(dropIconSrc('stone', 1)).toBe('/wiki-assets/chests/skill_stone_chest_easy.png');
    expect(dropIconSrc('stone', 5)).toBe('/wiki-assets/chests/skill_stone_chest_inferno.png');
    expect(dropIconSrc('gem', 1)).toBe('/wiki-assets/chests/gem_chest_easy.png');
    expect(dropIconSrc('gem', 5)).toBe('/wiki-assets/chests/gem_chest_inferno.png');
  });

  /**
   * An item chest's grade follows the map level it drops at, not the difficulty, so tinting it
   * by band would assert a relationship the game does not have.
   */
  it('keeps the item chest fixed across every difficulty band', () => {
    const paths = [1, 2, 3, 4, 5].map((ato) => dropIconSrc('chest', ato));
    expect(new Set(paths).size, 'distinct item-chest sprites').toBe(1);
    expect(paths[0]).toBe('/wiki-assets/chests/item_chest.png');
  });

  it('clamps an out-of-range or non-finite band instead of building a path to nothing', () => {
    expect(dropIconSrc('time', 0)).toBe('/wiki-assets/houses/house_easy.png');
    expect(dropIconSrc('time', 9)).toBe('/wiki-assets/houses/house_inferno.png');
    expect(dropIconSrc('gem', Number.NaN)).toBe('/wiki-assets/chests/gem_chest_easy.png');
    expect(dropIconSrc('key', 2.4)).toBe('/wiki-assets/key/key_rare.png');
  });

  it('gives every drop row a distinct sprite, in every difficulty band', () => {
    const ids = Object.keys(DROP_RATES) as DropRateId[];
    for (const ato of [1, 2, 3, 4, 5]) {
      const paths = ids.map((id) => dropIconSrc(id, ato));
      // Two rows sharing one sprite would make the icons decorative noise instead of something
      // to match a row against — the whole reason they are here.
      expect(new Set(paths).size, `distinct sprites at ato ${ato}`).toBe(ids.length);
    }
  });

  it('points at the bundled gold coin chrome', () => {
    expect(goldIconSrc()).toBe('/wiki-assets/nav/icon_gold.png');
  });

  it('points at the bundled item-chest sprite, matching dropIconSrc(\'chest\', ato)', () => {
    expect(chestIconSrc()).toBe('/wiki-assets/chests/item_chest.png');
    expect(chestIconSrc()).toBe(dropIconSrc('chest', 3));
  });

  it('points at the bundled gate-timer clock chrome', () => {
    expect(clockIconSrc()).toBe('/wiki-assets/icons/icon_clock.png');
  });
});

describe('normalizeHero skin', () => {
  it('defaults skin to 0 and preserves imported value', () => {
    expect(normalizeHero({ id: 'a', name: 'A' }).skin).toBe(0);
    expect(normalizeHero({ id: 'b', name: 'B', skin: 3 }).skin).toBe(3);
    expect(normalizeHero({ id: 'c', name: 'C', skin: 5 }).skin).toBe(5);
  });

  it('keeps save skin 1 and 2 on disk (display remap only)', () => {
    expect(normalizeHero({ id: 'd', name: 'D', skin: 1 }).skin).toBe(1);
    expect(normalizeHero({ id: 'e', name: 'E', skin: 2 }).skin).toBe(2);
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero2_avatar.png');
  });
});
