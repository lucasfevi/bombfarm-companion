import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { normalizeHero } from '@/shared/lib/storage';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';
import { HERO_SKIN_COUNT, heroAvatarSrc, isKnownSkin, itemIconSrc, normalizeSkin, rarityCrystalSrc, abilityIconSrc, goldIconSrc, propIconSrc } from '@bombfarm/domain/wiki-assets';

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
  });

  it('clamps skin to 0..(HERO_SKIN_COUNT-1)', () => {
    expect(normalizeSkin(-1)).toBe(0);
    expect(normalizeSkin(5)).toBe(5);
    expect(normalizeSkin(6.4)).toBe(6);
    expect(normalizeSkin(7)).toBe(7);
    expect(normalizeSkin(99)).toBe(7);
    expect(normalizeSkin('x')).toBe(0);
  });

  it('treats skin 7 as known and 8 as unknown', () => {
    expect(HERO_SKIN_COUNT).toBe(8);
    expect(isKnownSkin(7)).toBe(true);
    expect(isKnownSkin(8)).toBe(false);
  });

  /**
   * End-to-end through `parseSaveFile`, not just the predicate: `isKnownSkin` shares the
   * `HERO_SKIN_COUNT` bound, so before the 8th appearance landed a save carrying `skin: 7`
   * was rejected as out of range and the real value was replaced by the neutral placeholder
   * `0` — the stored value on disk was discarded, not merely mis-rendered. Nothing covered
   * this boundary through the actual import path, which is why the regression was invisible.
   */
  it('keeps a saved skin 7 through import, and still degrades skin 8 to the placeholder', () => {
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

    const known = withSkin(7).candidates[0];
    expect(known.record.skin).toBe(7);
    expect(skinIssues(known)).toEqual([]);

    // One past the end must NOT clamp to the nearest index (AD-BSP-29) — a nearest-index
    // clamp would render a different hero's face, the exact failure this whole change is about.
    const unknown = withSkin(8).candidates[0];
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

  it('keeps save skin 1 and 2 on disk (display remap only)', () => {
    expect(normalizeHero({ id: 'd', name: 'D', skin: 1 }).skin).toBe(1);
    expect(normalizeHero({ id: 'e', name: 'E', skin: 2 }).skin).toBe(2);
    expect(heroAvatarSrc(1)).toBe('/wiki-assets/hero/hero3_avatar.png');
    expect(heroAvatarSrc(2)).toBe('/wiki-assets/hero/hero2_avatar.png');
  });
});
