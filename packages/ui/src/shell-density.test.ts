import { describe, expect, it } from 'vitest';
import {
  SHELL_ACTIONS_COLLAPSE_WIDTH,
  SHELL_ICON_TABS_WIDTH,
  shellDensityFor,
} from './shell-density';

describe('shellDensityFor', () => {
  it('gives up the secondary actions before it gives up a tab label', () => {
    expect(SHELL_ICON_TABS_WIDTH).toBeLessThan(SHELL_ACTIONS_COLLAPSE_WIDTH);
  });

  it('is full only at or above the width the whole bar measured', () => {
    expect(shellDensityFor(SHELL_ACTIONS_COLLAPSE_WIDTH)).toBe('full');
    expect(shellDensityFor(SHELL_ACTIONS_COLLAPSE_WIDTH + 400)).toBe('full');
    expect(shellDensityFor(SHELL_ACTIONS_COLLAPSE_WIDTH - 1)).toBe('actions-collapsed');
  });

  it('collapses the actions across the whole band between the two widths', () => {
    expect(shellDensityFor(SHELL_ICON_TABS_WIDTH)).toBe('actions-collapsed');
    expect(shellDensityFor(SHELL_ACTIONS_COLLAPSE_WIDTH - 1)).toBe('actions-collapsed');
    expect(shellDensityFor(SHELL_ICON_TABS_WIDTH - 1)).toBe('icon-tabs');
  });

  it('never runs out of answers, however small the window gets', () => {
    for (const width of [0, 1, 120, 320]) expect(shellDensityFor(width)).toBe('icon-tabs');
  });
});
