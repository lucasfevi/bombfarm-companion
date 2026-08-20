import type { ComponentPropsWithoutRef } from 'react';
import { abilityCardRecipe } from './ability-card.recipe';
import { cn } from './cn';

export type AbilityCardProps = ComponentPropsWithoutRef<'div'> & {
  selected: boolean;
  onSheet: boolean;
  lockedOut: boolean;
};

/**
 * Ability-card primitive — `<div>` dressed by `abilityCardRecipe`
 * (compound `onSheet × selected` + `lockedOut`). `className` merges via `cn()`.
 */
export function AbilityCard({
  selected,
  onSheet,
  lockedOut,
  className,
  ...props
}: AbilityCardProps) {
  return (
    <div className={cn(abilityCardRecipe({ selected, onSheet, lockedOut }), className)} {...props} />
  );
}
