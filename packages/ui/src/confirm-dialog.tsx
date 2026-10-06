'use client';

import { useId, type ReactNode } from 'react';
import { Button, Dialog, Icon } from './index';
import { confirmDialogBodyClass, confirmDialogPopupRecipe } from './dialog.recipe';
import {
  dialogActionsClass,
  dialogDescClass,
} from './panel-field.recipe';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Block content under the description, in a `<div>` that scrolls inside the popup. The dialog
   *  is described by the description when there is one, by this body otherwise. */
  children?: ReactNode;
  /** `wide` gives a body of block content more room; the default fits a line of copy. */
  size?: 'compact' | 'wide';
  confirmLabel: string;
  cancelLabel: string;
  /** Names the corner close on its own, so it and the Cancel action are told apart by name. */
  closeLabel: string;
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
  children,
  size = 'compact',
  confirmLabel,
  cancelLabel,
  closeLabel,
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  const descriptionId = useId();
  const bodyId = useId();
  const describedBy = description ? descriptionId : children ? bodyId : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className={confirmDialogPopupRecipe({ size })} aria-describedby={describedBy}>
          {/* The close sits in the popup's own corner rather than inside the padding, so it
              reads as the box's control and the title keeps the full line. */}
          <span className="absolute top-2 right-2">
            <Dialog.Close aria-label={closeLabel}>
              <Icon name="x-mark" />
            </Dialog.Close>
          </span>
          <Dialog.Head className="pr-6">
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Head>
          {description ? (
            <p id={descriptionId} className={dialogDescClass}>
              {description}
            </p>
          ) : null}
          {children ? (
            <div id={bodyId} className={confirmDialogBodyClass}>
              {children}
            </div>
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
