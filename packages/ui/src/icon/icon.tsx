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
  const boxClass = cn('inline-flex shrink-0', iconSizeClass[size], className);

  // react-icons forces `aria-hidden` on the SVG after prop spread, so semantics
  // live on a wrapping span; the glyph stays decorative.
  return (
    <span
      className={boxClass}
      {...dataProps}
      {...(labeled
        ? { role: 'img' as const, 'aria-label': label }
        : { 'aria-hidden': true as const })}
    >
      <Glyph aria-hidden focusable="false" className="size-full" />
    </span>
  );
}
