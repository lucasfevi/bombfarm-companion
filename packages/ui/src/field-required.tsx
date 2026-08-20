import { cn } from './cn';
import { reqClass } from './panel-field.recipe';

export type FieldRequiredProps = {
  /** When false, the badge stays mounted but invisible so layout does not shift. */
  show: boolean;
  children: string;
  className?: string;
};

/**
 * "required" badge that always occupies space.
 * Toggle with `show` + `invisible` — never mount/unmount — to avoid layout shift (CLS).
 */
export function FieldRequired({ show, children, className }: FieldRequiredProps) {
  return (
    <span className={cn(reqClass, !show && 'invisible', className)} aria-hidden={!show}>
      {children}
    </span>
  );
}
