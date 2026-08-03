import type { ComponentProps } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '../cn';
import { dialogPopupClass } from '../dialog.recipe';

export function DialogPopup({ className, ...props }: ComponentProps<typeof BaseDialog.Popup>) {
  return <BaseDialog.Popup className={cn(dialogPopupClass, className)} {...props} />;
}
