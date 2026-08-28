import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * MP1 regression: recipe class strings live in `packages/ui/src`. If
 * `globals.css` drops that `@source`, package-only utilities (ability-card
 * `auto-fill`/`240px` grid, sheet color-mix borders, …) never enter the CSS
 * bundle and the Abilities tab stacks full-width unstyled cards.
 */
const globalsCss = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../app/globals.css',
);

describe('Tailwind @source covers @bombfarm/ui', () => {
  it('globals.css sources packages/ui recipes', () => {
    const css = readFileSync(globalsCss, 'utf8');
    expect(css).toMatch(/@source\s+['"][^'"]*packages\/ui\/src\/\*\*\/\*\.\{ts,tsx\}['"]/);
  });
});

/**
 * Same failure shape, one package over: `game-art.recipe.ts`'s literal rarity classes
 * (`border-rar-4`, `text-rar-2`, …) live in `packages/game-art/src`. Without this `@source`
 * Tailwind's JIT scanner never sees them and rarity chrome silently loses its colour.
 */
describe('Tailwind @source covers @bombfarm/game-art', () => {
  it('globals.css sources packages/game-art recipes', () => {
    const css = readFileSync(globalsCss, 'utf8');
    expect(css).toMatch(/@source\s+['"][^'"]*packages\/game-art\/src\/\*\*\/\*\.\{ts,tsx\}['"]/);
  });
});
