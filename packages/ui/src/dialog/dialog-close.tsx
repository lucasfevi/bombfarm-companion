import type { ComponentProps } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '../cn';
import { buttonRecipe } from '../button.recipe';

export function DialogClose({ className, ...props }: ComponentProps<typeof BaseDialog.Close>) {
  return (
    <BaseDialog.Close className={cn(buttonRecipe({ variant: 'icon' }), className)} {...props} />
  );
}
