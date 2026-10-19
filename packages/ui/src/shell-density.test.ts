import { describe, expect, it } from 'vitest';
import { WINDOW_CONTROLS_WIDTH } from './window-controls.recipe';
import {
  SHELL_ACTIONS_COLLAPSE_WIDTH,
  SHELL_BRAND_MARK_WIDTH,
  SHELL_ICON_TABS_WIDTH,
  SHELL_PREMIUM_TAB_WIDTHS,
  shellDensityFor,
} from './shell-density';

describe('shellDensityFor', () => {
  it('pins the widths measured off the nine-tab bar with the gear', () => {
    expect(SHELL_ICON_TABS_WIDTH).toBe(1238);
    expect(SHELL_BRAND_MARK_WIDTH).toBe(942);
    expect(SHELL_ACTIONS_COLLAPSE_WIDTH).toBe(817);
  });

  it('pins the widths measured off the ten-tab bar with the Premium tab', () => {
    expect(SHELL_PREMIUM_TAB_WIDTHS).toEqual({ iconTabs: 1319, brandMark: 978, actionsCollapse: 853 });
  });

  it('gives up a tab label first, then the brand words, and the actions last, in both sets', () => {
    expect(SHELL_ACTIONS_COLLAPSE_WIDTH).toBeLessThan(SHELL_BRAND_MARK_WIDTH);
    expect(SHELL_BRAND_MARK_WIDTH).toBeLessThan(SHELL_ICON_TABS_WIDTH);
    const { actionsCollapse, brandMark, iconTabs } = SHELL_PREMIUM_TAB_WIDTHS;
    expect(actionsCollapse).toBeLessThan(brandMark);
    expect(brandMark).toBeLessThan(iconTabs);
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

  it('uses the Premium tab set when the tab is shown', () => {
    const { actionsCollapse, brandMark, iconTabs } = SHELL_PREMIUM_TAB_WIDTHS;
    expect(shellDensityFor(iconTabs, true)).toBe('full');
    expect(shellDensityFor(iconTabs - 1, true)).toBe('icon-tabs');
    expect(shellDensityFor(brandMark, true)).toBe('icon-tabs');
    expect(shellDensityFor(brandMark - 1, true)).toBe('brand-mark');
    expect(shellDensityFor(actionsCollapse, true)).toBe('brand-mark');
    expect(shellDensityFor(actionsCollapse - 1, true)).toBe('actions-collapsed');
  });

  it('keeps the released set when the tab is not shown, and a width between the sets differs by tab', () => {
    expect(shellDensityFor(1250, false)).toBe('full');
    expect(shellDensityFor(1250, true)).toBe('icon-tabs');
    expect(shellDensityFor(SHELL_ICON_TABS_WIDTH)).toBe(shellDensityFor(SHELL_ICON_TABS_WIDTH, false));
  });

  it('keeps every action in the bar at the smallest window a player can drag to', () => {
    // 960px is `createMainWindow`'s own `minWidth`, less the strip the caption cluster takes.
    // Read from the cluster's own constant rather than written out: the OS drew those buttons at
    // 136px until the header took the job over at 100, and a number copied here would still say
    // 136 — landing this assertion in a band the running app never reaches.
    expect(shellDensityFor(960 - WINDOW_CONTROLS_WIDTH)).toBe('brand-mark');
    expect(shellDensityFor(960 - WINDOW_CONTROLS_WIDTH, true)).toBe('brand-mark');
  });

  it('collapses the actions only below the smallest window a player can drag to', () => {
    expect(shellDensityFor(860 - WINDOW_CONTROLS_WIDTH)).toBe('actions-collapsed');
    expect(shellDensityFor(860 - WINDOW_CONTROLS_WIDTH, true)).toBe('actions-collapsed');
  });

  it('still shrinks the brand to its mark just above the smallest window a player can drag to', () => {
    // This pins that the band above the minimum still exists rather than having collapsed away.
    expect(shellDensityFor(1100 - WINDOW_CONTROLS_WIDTH)).toBe('icon-tabs');
    expect(shellDensityFor(1000 - WINDOW_CONTROLS_WIDTH)).toBe('brand-mark');
    expect(shellDensityFor(1100 - WINDOW_CONTROLS_WIDTH, true)).toBe('icon-tabs');
    expect(shellDensityFor(1000 - WINDOW_CONTROLS_WIDTH, true)).toBe('brand-mark');
  });

  it('never runs out of answers, however small the window gets', () => {
    for (const width of [0, 1, 120, 320]) {
      expect(shellDensityFor(width)).toBe('actions-collapsed');
      expect(shellDensityFor(width, true)).toBe('actions-collapsed');
    }
  });
});
