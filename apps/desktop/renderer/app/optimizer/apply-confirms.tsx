'use client';

/**
 * The three confirms an apply row opens before it spends anything — each names the cost on its
 * own primary button, the way the forge queue's own confirm does. The Reset confirm's per-hero
 * list is phrasing content inside the dialog's own `<p>` description (`block` spans, valid inside
 * a paragraph) — `ConfirmDialog` itself is untouched.
 *
 * Every confirm's title/body/label is built by a plain function rather than read out of the
 * rendered `<ConfirmDialog>` tree: everything under its `Dialog.Portal` is skipped by
 * `renderToStaticMarkup` (no jsdom in this project — `consent-modal.test.tsx`'s own reasoning), so
 * a test can only see what these functions return, never what the mounted dialog draws.
 */
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { RowSkipReason } from '../../lib/optimizer/apply-labels';

/** One hero line the Reset confirm names — a respec, a place-only hero, or one the preflight will
 *  skip. `skipReason === null` means the hero is pending and counted in the primary button's cost. */
export type ApplyPointsConfirmHero = {
  readonly index: number;
  readonly name: string;
  readonly level: number;
  readonly needsRespec: boolean;
  readonly points: number;
  readonly gold: number;
  readonly skipReason: RowSkipReason | null;
};

function rowSkipText(reason: RowSkipReason, t: Copy): string {
  switch (reason) {
    case 'itemMissing':
      return t.applySkipItemMissing;
    case 'heroMissing':
      return t.applySkipHeroMissing;
    case 'itemMoved':
      return t.applySkipItemMoved;
    case 'allocationChanged':
      return t.applySkipAllocationChanged;
    case 'notEnoughGold':
      return t.applySkipNotEnoughGold;
    case 'forgeAtTarget':
      return t.applySkipForgeAtTarget;
  }
}

export type ConfirmCopy = { readonly title: string; readonly description: ReactNode; readonly confirmLabel: string; readonly cancelLabel: string };

export function equipConfirmCopy(pendingCount: number, queueRunning: boolean, t: Copy): ConfirmCopy {
  return {
    title: t.applyConfirmEquipTitle,
    description: queueRunning ? `${t.applyConfirmEquipBody} ${t.applyConfirmQueuePauses}` : t.applyConfirmEquipBody,
    confirmLabel: sub(t.applyConfirmEquip, { count: pendingCount }),
    cancelLabel: t.applyConfirmCancel,
  };
}

export function pointsConfirmCopy(
  heroes: readonly ApplyPointsConfirmHero[],
  queueRunning: boolean,
  t: Copy,
  gold: (amount: number) => string,
): ConfirmCopy {
  const pendingGold = heroes.filter((hero) => hero.skipReason === null && hero.needsRespec).reduce((sum, hero) => sum + hero.gold, 0);
  const lines = heroes.map((hero) => {
    const text =
      hero.skipReason !== null
        ? sub(t.applyConfirmPointsHeroSkip, { hero: hero.name, reason: rowSkipText(hero.skipReason, t) })
        : hero.needsRespec
          ? sub(t.applyConfirmPointsHeroRespec, { hero: hero.name, level: hero.level, points: hero.points, gold: gold(hero.gold) })
          : sub(t.applyConfirmPointsHeroPlace, { hero: hero.name, level: hero.level, points: hero.points });
    return (
      <span key={hero.index} className="block">
        {text}
      </span>
    );
  });
  return {
    title: t.applyConfirmPointsTitle,
    description: (
      <>
        <span className="block">{t.applyConfirmPointsBody}</span>
        {lines}
        {queueRunning ? <span className="block">{t.applyConfirmQueuePauses}</span> : null}
      </>
    ),
    confirmLabel: sub(t.applyConfirmPoints, { gold: gold(pendingGold) }),
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

export function ApplyPointsConfirm({
  open,
  heroes,
  queueRunning,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  heroes: readonly ApplyPointsConfirmHero[];
  queueRunning: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const copy = pointsConfirmCopy(heroes, queueRunning, t, (amount) => formatCount(amount, locale));
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
