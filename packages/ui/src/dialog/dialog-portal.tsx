import type { ComponentProps } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';

export function DialogPortal(props: ComponentProps<typeof BaseDialog.Portal>) {
  return <BaseDialog.Portal {...props} />;
}
