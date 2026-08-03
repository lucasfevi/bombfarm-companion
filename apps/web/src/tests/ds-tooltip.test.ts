import { describe, expect, it } from 'vitest';
import {
  tooltipPopupRecipe,
  tooltipPositionerClass,
  tooltipStatusListClass,
  tooltipStatusListSoftClass,
  tooltipStatusTitleClass,
} from '@bombfarm/ui/tooltip.recipe';
import { Tooltip } from '@bombfarm/ui/tooltip';

describe('tooltipPopupRecipe', () => {
  it('default tone uses line border', () => {
    expect(tooltipPopupRecipe()).toContain('border-line');
    expect(tooltipPopupRecipe()).toContain('bg-surface');
    expect(tooltipPopupRecipe()).toContain('max-w-72');
  });

  it('warn / soft tones tint the border', () => {
    expect(tooltipPopupRecipe({ tone: 'warn' })).toContain('var(--warn)');
    expect(tooltipPopupRecipe({ tone: 'soft' })).toContain('var(--accent)');
    expect(tooltipPopupRecipe({ tone: 'warn' })).not.toBe(tooltipPopupRecipe({ tone: 'soft' }));
  });
});

describe('tooltip status chrome', () => {
  it('exposes title + list classes for structured tips', () => {
    expect(tooltipStatusTitleClass).toContain('font-bold');
    expect(tooltipStatusListClass).toContain('list-disc');
    expect(tooltipStatusListSoftClass).toContain('marker:text-accent');
    expect(tooltipPositionerClass).toBe('z-50');
  });

  it('exports compound Tooltip with StatusBody', () => {
    expect(typeof Tooltip.Provider).toBe('function');
    expect(typeof Tooltip.Root).toBe('function');
    expect(typeof Tooltip.Trigger).toBe('function');
    expect(typeof Tooltip.Portal).toBe('function');
    expect(typeof Tooltip.Positioner).toBe('function');
    expect(typeof Tooltip.Popup).toBe('function');
    expect(typeof Tooltip.StatusBody).toBe('function');
  });
});
