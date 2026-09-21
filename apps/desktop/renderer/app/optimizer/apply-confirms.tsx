'use client';

/**
 * The Equip and Forge confirms an apply row opens before it spends anything — each names the
 * cost on its own primary button, the way the forge queue's own confirm does. The Reset confirm,
 * with its per-hero switches, is its own dialog in `apply-points-confirm.tsx`.
 *
 * Every confirm's title/body/label is built by a plain function rather than read out of the
 * rendered `<ConfirmDialog>` tree: everything under its `Dialog.Portal` is skipped by
 * `renderToStaticMarkup` (no jsdom in this project — `consent-modal.test.tsx`'s own reasoning), so
 * a test can only see what these functions return, never what the mounted dialog draws.
 */
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../../lib/copy';

export type ConfirmCopy = { readonly title: string; readonly description: ReactNode; readonly confirmLabel: string; readonly cancelLabel: string };

export function equipConfirmCopy(pendingCount: number, queueRunning: boolean, t: Copy): ConfirmCopy {
  return {
    title: t.applyConfirmEquipTitle,
    description: queueRunning ? `${t.applyConfirmEquipBody} ${t.applyConfirmQueuePauses}` : t.applyConfirmEquipBody,
    confirmLabel: sub(t.applyConfirmEquip, { count: pendingCount }),
    cancelLabel: t.applyConfirmCancel,
  };
}

export function forgeConfirmCopy(count: number, t: Copy): ConfirmCopy {
  return {
    title: t.applyConfirmForgeTitle,
    description: t.applyConfirmForgeBody,
    confirmLabel: sub(t.applyConfirmForge, { count }),
    cancelLabel: t.applyConfirmCancel,
  };
}

export function ApplyEquipConfirm({
  open,
  pendingCount,
  queueRunning,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  pendingCount: number;
  queueRunning: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useCopy();
  const copy = equipConfirmCopy(pendingCount, queueRunning, t);
  return <ConfirmDialog open={open} onOpenChange={onOpenChange} onConfirm={onConfirm} {...copy} />;
}

export function ApplyForgeConfirm({
  open,
  count,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useCopy();
  const copy = forgeConfirmCopy(count, t);
  return <ConfirmDialog open={open} onOpenChange={onOpenChange} onConfirm={onConfirm} {...copy} />;
}
