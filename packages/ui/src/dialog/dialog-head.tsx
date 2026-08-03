import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { dialogHeadClass } from '../panel-field.recipe';

export function DialogHead({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(dialogHeadClass, className)} {...props} />;
}
