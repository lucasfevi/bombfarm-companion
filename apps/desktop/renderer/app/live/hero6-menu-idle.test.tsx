import { describe, expect, it } from 'vitest';
import { HERO6_MENU_IDLE_FRAME_MS, HERO6_MENU_IDLE_FRAMES } from './hero6-menu-idle';

describe('HERO6_MENU_IDLE_FRAMES', () => {
  it('has all 15 frames', () => {
    expect(HERO6_MENU_IDLE_FRAMES).toHaveLength(15);
    expect(new Set(HERO6_MENU_IDLE_FRAMES).size).toBe(15);
  });

  it('orders frames numerically — frame 10 comes after frame 9, not after frame 1', () => {
    expect(HERO6_MENU_IDLE_FRAMES[9]).toBe('/wiki-assets/hero/hero6-menu-idle/hero6_idle_menu10.png');
    expect(HERO6_MENU_IDLE_FRAMES.indexOf('/wiki-assets/hero/hero6-menu-idle/hero6_idle_menu2.png')).toBeLessThan(
      HERO6_MENU_IDLE_FRAMES.indexOf('/wiki-assets/hero/hero6-menu-idle/hero6_idle_menu10.png'),
    );
  });

  it('lists every frame 1 through 15 in order', () => {
    expect(HERO6_MENU_IDLE_FRAMES).toEqual(
      Array.from({ length: 15 }, (_, index) => `/wiki-assets/hero/hero6-menu-idle/hero6_idle_menu${String(index + 1)}.png`),
    );
  });

  it('runs slower than the bomb-activation sequence, as an idle loop should', () => {
    expect(HERO6_MENU_IDLE_FRAME_MS).toBe(100);
  });
});
