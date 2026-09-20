import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { dialogFooterClass } from '../dialog.recipe';

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(dialogFooterClass, className)} {...props} />;
}
