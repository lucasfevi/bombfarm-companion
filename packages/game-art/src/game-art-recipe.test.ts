import { describe, expect, it } from 'vitest';
import { LETTER_BANDS } from '@bombfarm/domain/roll-quality';
import {
  artFrameRecipe,
  heroRankTextClass,
  rarityTextClass,
  abilityIconRecipe,
  iconMetaGlyphRecipe,
  rosterIconTooltipTriggerClass,
  rosterInactiveChromeClass,
} from './game-art.recipe';

describe('game-art.recipe', () => {
  it('artFrameRecipe encodes rarity border, shape, and fill', () => {
    expect(artFrameRecipe({ size: 'md', rarity: 3 })).toContain('border-rar-3');
    expect(artFrameRecipe({ size: 'xl', rarity: 0 })).toContain('rounded-sm');
    expect(artFrameRecipe({ size: 'xs', rarity: 0 })).toContain('w-7');
    expect(artFrameRecipe({ size: 'md', rarity: 2 })).toContain('w-11');
    expect(artFrameRecipe({ size: 'lg', rarity: 2 })).toContain('w-12');
    expect(artFrameRecipe({ size: 'xl', rarity: 2 })).toContain('w-16');
    expect(artFrameRecipe({ size: 'lg', shape: 'square', rarity: 2 })).toContain('aspect-square');
    expect(artFrameRecipe({ size: 'lg', shape: 'portrait', rarity: 2 })).toContain('aspect-[18/19]');
    expect(artFrameRecipe({ size: 'lg', fill: 'rarity', rarity: 3 })).toContain('--rar-slot-3-glow');
    expect(artFrameRecipe({ size: 'lg', fill: 'rarity', rarity: 3 })).toContain('radial-gradient');
    expect(artFrameRecipe({ size: 'lg', fill: 'rarity', rarity: 4 })).toContain('linear-gradient');
    expect(artFrameRecipe({ size: 'lg', fill: 'neutral', rarity: 3 })).not.toContain('--rar-slot-3-glow');
    expect(artFrameRecipe({ size: 'lg', rarity: 2 })).toContain('isolate');
  });

  it('icon meta glyphs are halo text without a plaque fill', () => {
    const level = iconMetaGlyphRecipe({ size: 'compact', place: 'top-end' });
    expect(level).toContain('top-0.5');
    expect(level).toContain('right-0.5');
    expect(level).toContain('text-shadow');
    expect(level).not.toContain('bg-[');
    expect(level).toContain('z-[1]');
    expect(level).not.toContain('z-10');
    expect(iconMetaGlyphRecipe({ size: 'roomy', place: 'bottom-end' })).toContain('bottom-0.5');
    expect(iconMetaGlyphRecipe({ size: 'roomy', place: 'bottom-end' })).toContain('var(--rar-4)');
    expect(iconMetaGlyphRecipe({ size: 'roomy', place: 'bottom-center' })).toContain('text-center');
    expect(iconMetaGlyphRecipe({ size: 'roomy', place: 'bottom-center' })).toContain('text-[11px]');
  });

  it('abilityIconRecipe uses neutral border and shared radius aligned to art frames', () => {
    expect(abilityIconRecipe({ size: 'xs' })).toContain('border-line');
    expect(abilityIconRecipe({ size: 'lg' })).toContain('rounded-sm');
    expect(abilityIconRecipe({ size: 'md' })).toContain('size-11');
    expect(abilityIconRecipe({ size: 'lg' })).toContain('size-12');
    expect(abilityIconRecipe({ size: 'xl' })).toContain('size-16');
  });

  it('rosterIconTooltipTriggerClass is borderless chrome for icon tooltips', () => {
    expect(rosterIconTooltipTriggerClass).toContain('bg-transparent');
    expect(rosterIconTooltipTriggerClass).toContain('border-0');
  });

  it('rosterInactiveChromeClass desaturates shelved heroes', () => {
    expect(rosterInactiveChromeClass).toContain('grayscale');
    expect(rosterInactiveChromeClass).toContain('opacity-55');
  });
});

describe('heroRankTextClass', () => {
  it('walks the same six-step colour ladder the rarities use, one step per grade', () => {
    const classes = LETTER_BANDS.letters.map((letter) => heroRankTextClass(letter));

    // The claim is the pairing, not the palette: grade i is painted in rarity i's colour.
    expect(classes).toEqual(LETTER_BANDS.letters.map((_, index) => rarityTextClass(index)));
    // And the ladder really is six distinct colours, so the assertion above is not six nulls.
    expect(new Set(classes).size).toBe(LETTER_BANDS.letters.length);
    expect(classes.every((value) => typeof value === 'string')).toBe(true);
  });

  it('paints the lowest and the highest grade differently, in the ladder direction', () => {
    const lowest = LETTER_BANDS.letters[0];
    const highest = LETTER_BANDS.letters[LETTER_BANDS.letters.length - 1];

    expect(heroRankTextClass(lowest)).toBe(rarityTextClass(0));
    expect(heroRankTextClass(highest)).toBe(rarityTextClass(LETTER_BANDS.letters.length - 1));
    expect(heroRankTextClass(lowest)).not.toBe(heroRankTextClass(highest));
  });

  it('leaves a grade the table does not know uncoloured rather than painting it the bottom one', () => {
    expect(heroRankTextClass('Z')).toBeUndefined();
    expect(heroRankTextClass(undefined)).toBeUndefined();
    expect(heroRankTextClass('')).toBeUndefined();
  });

  it('reads a grade the game padded with spaces', () => {
    expect(heroRankTextClass(' S ')).toBe(heroRankTextClass('S'));
  });
});
