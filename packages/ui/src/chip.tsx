import type { ComponentPropsWithoutRef } from 'react';
import { chipRecipe, type ChipVariant } from './chip.recipe';
import { cn } from './cn';

export type ChipProps = ComponentPropsWithoutRef<'span'> & { variant?: ChipVariant };

/**
 * Chip primitive — non-interactive `<span>` badge dressed by `chipRecipe`.
 * Caller `className` is merged last-wins via `cn()`.
 */
export function Chip({ variant, className, ...props }: ChipProps) {
  return <span className={cn(chipRecipe({ variant }), className)} {...props} />;
}
