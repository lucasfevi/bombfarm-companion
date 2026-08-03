import type { ComponentPropsWithoutRef } from 'react';
import { panelRecipe } from './panel-field.recipe';
import { cn } from './cn';

export type PanelProps = ComponentPropsWithoutRef<'section'> & {
  focus?: boolean;
  need?: boolean;
  aligned?: boolean;
  unverified?: boolean;
};

/**
 * Panel primitive — `<section>` dressed by `panelRecipe` (focus/aligned/
 * unverified; `need` is retained as a no-op for call-site compatibility).
 * Required state uses `FieldRequired` text only — never a warn outline.
 */
export function Panel({ focus, need, aligned, unverified, className, ...props }: PanelProps) {
  return (
    <section
      className={cn(panelRecipe({ focus, need, aligned, unverified }), className)}
      {...props}
    />
  );
}
