import type { ComponentType } from 'react';
import type { IconSize } from './icon-size';

export type IconGlyphProps = {
  className?: string;
  focusable?: 'false';
  'aria-hidden'?: true;
} & Partial<Record<`data-${string}`, string | number | boolean>>;

export type IconGlyph = ComponentType<IconGlyphProps>;

export type IconProps<Name extends string = string> = {
  name: Name;
  size?: IconSize;
  className?: string;
  /** When set (non-empty), the wrapper is `role="img"` + `aria-label`; otherwise decorative. */
  label?: string;
} & Partial<Record<`data-${string}`, string | number | boolean>>;
