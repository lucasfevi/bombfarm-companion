import { describe, expect, it } from 'vitest';
import type { IconProps } from '@bombfarm/ui';

export const _validDecorativeIconProps: IconProps = {
  name: 'chevron-down',
};

export const _validLabeledIconProps: IconProps = {
  name: 'x-mark',
  label: 'Close',
};

// @ts-expect-error unknown name is not assignable to IconProps
export const _invalidUnknownName: IconProps = { name: 'not-a-glyph' };

describe('Icon prop types', () => {
  it('exports valid decorative and labeled prop shapes', () => {
    expect(_validDecorativeIconProps.name).toBe('chevron-down');
    expect(_validLabeledIconProps.label).toBe('Close');
  });
});
