import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { dialogBodyClass } from '../dialog.recipe';

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(dialogBodyClass, className)} {...props} />;
}
