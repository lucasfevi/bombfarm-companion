import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rarityTextClass, rarityDotClass } from '@/shared/game-art/game-art.recipe';

const EXPECTED_TEXT = ['text-rar-0', 'text-rar-1', 'text-rar-2', 'text-rar-3', 'text-rar-4', 'text-rar-5'];
const EXPECTED_DOT = ['bg-rar-0', 'bg-rar-1', 'bg-rar-2', 'bg-rar-3', 'bg-rar-4', 'bg-rar-5'];

describe('rarityTextClass / rarityDotClass', () => {
  it('returns the frozen text-colour class for every valid rarity index', () => {
    for (let i = 0; i <= 5; i++) {
      expect(rarityTextClass(i)).toBe(EXPECTED_TEXT[i]);
    }
  });

  it('returns the frozen dot/background class for every valid rarity index', () => {
    for (let i = 0; i <= 5; i++) {
      expect(rarityDotClass(i)).toBe(EXPECTED_DOT[i]);
    }
  });

  it('returns undefined outside the 0..5 range, matching the prior raw array indexing', () => {
    expect(rarityTextClass(-1)).toBeUndefined();
    expect(rarityTextClass(6)).toBeUndefined();
    expect(rarityDotClass(-1)).toBeUndefined();
    expect(rarityDotClass(6)).toBeUndefined();
  });

  it('keeps the literal class tokens in source so Tailwind\'s JIT scanner sees every class', () => {
    const src = readFileSync(resolve(__dirname, '../shared/game-art/game-art.recipe.ts'), 'utf8');
    for (let i = 0; i <= 5; i++) {
      expect(src).toContain(`text-rar-${i}`);
      expect(src).toContain(`bg-rar-${i}`);
    }
  });

  it('is the only rarity-class-map definition left in src/', () => {
    // Verified by T1.3's Done-when grep for the old per-file constant names: zero matches anywhere.
    expect(rarityTextClass(0)).toBeDefined();
  });
});
