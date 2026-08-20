import type { ComponentPropsWithoutRef } from 'react';
import {
  inlineFieldsClass,
  inlineFieldsDenseClass,
  stackFieldsClass,
} from './panel-field.recipe';
import { cn } from './cn';

const layouts = {
  inline: inlineFieldsClass,
  'inline-dense': inlineFieldsDenseClass,
  stack: stackFieldsClass,
} as const;

export type FieldsLayout = keyof typeof layouts;

export type FieldsProps = ComponentPropsWithoutRef<'div'> & { layout?: FieldsLayout };

/**
 * Fields primitive — labelled-control grid container. `layout` selects the
 * inline / dense / stack field bundle (descendant-styled inputs/labels).
 * `className` merges last-wins via `cn()`.
 */
export function Fields({ layout = 'inline', className, ...props }: FieldsProps) {
  return <div className={cn(layouts[layout], className)} {...props} />;
}
