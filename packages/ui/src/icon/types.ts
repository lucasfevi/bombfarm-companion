import type { ComponentType } from 'react';
import type { IconSize } from './icon-size';

export type IconGlyphProps = {
  className?: string;
  role?: 'img';
  focusable?: 'false';
  'aria-hidden'?: true;
  'aria-label'?: string;
} & Partial<Record<`data-${string}`, string | number | boolean>>;

export type IconGlyph = ComponentType<IconGlyphProps>;

type IconCommonProps<Name extends string = string> = {
  name: Name;
  size?: IconSize;
  className?: string;
} & Partial<Record<`data-${string}`, string | number | boolean>>;

type DecorativeIconProps<Name extends string = string> = IconCommonProps<Name> & {
  label?: never;
  'aria-hidden'?: true;
};

type LabeledIconProps<Name extends string = string> = IconCommonProps<Name> & {
  label: string;
  'aria-hidden'?: never;
};

export type IconProps<Name extends string = string> =
  | DecorativeIconProps<Name>
  | LabeledIconProps<Name>;
