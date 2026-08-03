import type { ComponentProps } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '../cn';
import { dialogBackdropClass } from '../dialog.recipe';

export function DialogBackdrop({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Backdrop>) {
  return <BaseDialog.Backdrop className={cn(dialogBackdropClass, className)} {...props} />;
}
