import { cn } from '../cn';
import { iconSizeClass } from './icon-size';
import { iconRegistry, type IconName } from './registry';
import type { IconGlyph } from './types';
import type { IconProps as IconPropsBase } from './types';

export type IconProps = IconPropsBase<IconName>;

export function Icon({ name, size = 'sm', className, label, ...dataProps }: IconProps) {
  const Glyph: IconGlyph | undefined = iconRegistry[name];
  if (!Glyph) return null;

  const labeled = typeof label === 'string' && label.length > 0;

  return (
    <Glyph
      {...dataProps}
      className={cn('shrink-0', iconSizeClass[size], className)}
      {...(labeled
        ? { role: 'img' as const, 'aria-label': label }
        : { 'aria-hidden': true as const, focusable: 'false' as const })}
    />
  );
}
