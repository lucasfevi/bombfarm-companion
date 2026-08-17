import { barRecipe, trackClass, type BarVariant } from './bar.recipe';
import { cn } from './cn';

export type BarProps = {
  /** Fill width as a percentage (0–100). */
  percent: number;
  variant?: BarVariant;
  className?: string;
};

/**
 * Bar primitive — track + fill for the advice ranking bars. `variant` selects
 * default vs best fill; `className` merges into the fill via `cn()`.
 */
export function Bar({ percent, variant, className }: BarProps) {
  return (
    <div className={trackClass}>
      <div className={cn(barRecipe({ variant }), className)} style={{ width: `${percent}%` }} />
    </div>
  );
}
