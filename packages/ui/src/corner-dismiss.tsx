import { Button, type ButtonProps } from './button';
import { cn } from './cn';
import { Icon } from './icon';

export type CornerDismissProps = Omit<ButtonProps, 'variant' | 'children' | 'aria-label'> & {
  /** The accessible name, already translated — the button draws only a glyph. */
  label: string;
};

/**
 * The remove / close control of a card, tile or row: an icon-only ✕ with no background, anchored
 * to the container's top-right corner and bleeding over its edge. The container must be
 * `relative`. It never sits in the header row beside other controls, so a card's own content keeps
 * its full width.
 */
export function CornerDismiss({ label, className, ...props }: CornerDismissProps) {
  return (
    <Button
      type="button"
      variant="icon"
      aria-label={label}
      className={cn('absolute', '-top-1', '-right-1', 'z-10', 'hover:bg-transparent', className)}
      {...props}
    >
      <Icon name="x-mark" size="xs" />
    </Button>
  );
}
