'use client';

import type { ReactNode } from 'react';
import { Button, Dialog, Icon } from './index';
import {
  dialogActionsClass,
  dialogDescClass,
} from './panel-field.recipe';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** When true, confirm button uses primary variant (default). Set false for neutral confirms. */
  destructive?: boolean;
};

/**
 * Themed confirmation shell — compact dialog for destructive or high-friction actions.
 * Uses the same Dialog compound primitive as import; sized for short copy + two actions.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className="!max-h-none !w-[min(92vw,420px)] !p-4">
          <Dialog.Head>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label={cancelLabel}>
              <Icon name="x-mark" />
            </Dialog.Close>
          </Dialog.Head>
          {description ? (
            <p className={dialogDescClass}>{description}</p>
          ) : null}
          <div className={dialogActionsClass}>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={destructive ? 'primary' : 'default'}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
