import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO6_BOMB_ACTIVATION_FRAME_MS, HERO6_BOMB_ACTIVATION_FRAMES } from './hero6-bomb-activation';

/** `wiki-assets.ts` builds a `/wiki-assets/...` public-root URL; resolve it against this
 *  package's own bundled art, the same way `@bombfarm/game-art`'s own asset tests do. */
const ASSETS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'game-art', 'assets');
const assetPath = (src: string) => resolve(ASSETS_ROOT, src.replace(/^\/wiki-assets\//, ''));

describe('hero6 bomb-activation frames', () => {
  it('lists 18 public PNG paths with a positive frame duration', () => {
    expect(HERO6_BOMB_ACTIVATION_FRAMES).toHaveLength(18);
    expect(HERO6_BOMB_ACTIVATION_FRAME_MS).toBeGreaterThan(0);
    for (const src of HERO6_BOMB_ACTIVATION_FRAMES) {
      expect(src).toMatch(/^\/wiki-assets\/hero\/hero6-bomb-activation\/hero_6_bomb_activation_\d{3}\.png$/);
      const disk = assetPath(src);
      expect(existsSync(disk), disk).toBe(true);
    }
  });
});
