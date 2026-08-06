export const ICON_SIZES = ['xs', 'sm', 'md', 'lg'] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export const iconSizeClass: Record<IconSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};
