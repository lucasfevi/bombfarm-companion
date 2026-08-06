import { describe, expect, it } from 'vitest';
import type { IconProps } from '@bombfarm/ui';

export const _validDecorativeIconProps: IconProps = {
  name: 'gem',
};

export const _validLabeledIconProps: IconProps = {
  name: 'gem',
  label: 'Gem',
};

// @ts-expect-error label and aria-hidden are mutually exclusive (ICO-07)
export const _invalidLabeledAndHidden: IconProps = { name: 'gem', label: 'x', 'aria-hidden': true };

// @ts-expect-error unknown name is not assignable to IconProps
export const _invalidUnknownName: IconProps = { name: 'not-a-glyph' };

describe('Icon prop types (ICO-07)', () => {
  it('exports valid decorative and labeled prop shapes', () => {
    expect(_validDecorativeIconProps.name).toBe('gem');
    expect(_validLabeledIconProps.label).toBe('Gem');
  });
});
