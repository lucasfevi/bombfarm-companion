import { describe, expect, it } from 'vitest';
import {
  HERO6_BOMB_ACTIVATION_FRAME_MS,
  HERO6_BOMB_ACTIVATION_FRAMES,
} from '@/features/team-plan/model/hero6-bomb-activation';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PUBLIC_ROOT = path.resolve(__dirname, '../../public');

describe('hero6 bomb-activation frames', () => {
  it('lists 18 public PNG paths with a positive frame duration', () => {
    expect(HERO6_BOMB_ACTIVATION_FRAMES).toHaveLength(18);
    expect(HERO6_BOMB_ACTIVATION_FRAME_MS).toBeGreaterThan(0);
    for (const src of HERO6_BOMB_ACTIVATION_FRAMES) {
      expect(src).toMatch(/^\/wiki-assets\/hero\/hero6-bomb-activation\/hero_6_bomb_activation_\d{3}\.png$/);
      const disk = path.join(PUBLIC_ROOT, src.replace(/^\//, ''));
      expect(existsSync(disk), disk).toBe(true);
    }
  });
});
