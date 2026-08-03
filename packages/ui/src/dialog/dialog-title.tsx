import type { ComponentProps } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '../cn';
import { dialogTitleClass } from '../panel-field.recipe';

export function DialogTitle({ className, ...props }: ComponentProps<typeof BaseDialog.Title>) {
  return <BaseDialog.Title className={cn(dialogTitleClass, className)} {...props} />;
}
