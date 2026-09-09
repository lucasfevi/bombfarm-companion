import { describe, expect, it } from 'vitest';
import { WINDOW_CONTROLS_WIDTH } from './window-controls.recipe';
import {
  SHELL_ACTIONS_COLLAPSE_WIDTH,
  SHELL_BRAND_MARK_WIDTH,
  SHELL_ICON_TABS_WIDTH,
  shellDensityFor,
} from './shell-density';

describe('shellDensityFor', () => {
  it('gives up a tab label first, then the brand words, and the actions last', () => {
    expect(SHELL_ACTIONS_COLLAPSE_WIDTH).toBeLessThan(SHELL_BRAND_MARK_WIDTH);
    expect(SHELL_BRAND_MARK_WIDTH).toBeLessThan(SHELL_ICON_TABS_WIDTH);
  });

  it('is full only at or above the width the whole bar measured', () => {
    expect(shellDensityFor(SHELL_ICON_TABS_WIDTH)).toBe('full');
    expect(shellDensityFor(SHELL_ICON_TABS_WIDTH + 400)).toBe('full');
    expect(shellDensityFor(SHELL_ICON_TABS_WIDTH - 1)).toBe('icon-tabs');
  });

  it('holds each stage across its whole band, down to the next width', () => {
    expect(shellDensityFor(SHELL_BRAND_MARK_WIDTH)).toBe('icon-tabs');
    expect(shellDensityFor(SHELL_BRAND_MARK_WIDTH - 1)).toBe('brand-mark');
    expect(shellDensityFor(SHELL_ACTIONS_COLLAPSE_WIDTH)).toBe('brand-mark');
    expect(shellDensityFor(SHELL_ACTIONS_COLLAPSE_WIDTH - 1)).toBe('actions-collapsed');
  });

  it('keeps the actions as controls at the smallest window a player can drag to', () => {
    // 960px is `createMainWindow`'s own `minWidth`, less the strip the caption cluster takes.
    // Read from the cluster's own constant rather than written out: the OS drew those buttons at
    // 136px until the header took the job over at 100, and a number copied here would still say
    // 136 — landing this assertion in a band the running app never reaches.
    expect(shellDensityFor(960 - WINDOW_CONTROLS_WIDTH)).toBe('brand-mark');
  });

  it('never runs out of answers, however small the window gets', () => {
    for (const width of [0, 1, 120, 320]) expect(shellDensityFor(width)).toBe('actions-collapsed');
  });
});
