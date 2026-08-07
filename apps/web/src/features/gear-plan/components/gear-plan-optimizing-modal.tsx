'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog } from '@bombfarm/ui';
import { dialogDescClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { Hero6BombActivationSprite } from './hero6-bomb-activation-sprite';

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function GearPlanOptimizingModal({
  open,
  t,
  onCancel,
}: {
  open: boolean;
  t: Strings;
  onCancel: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    setElapsedMs(0);
    const id = window.setInterval(() => setElapsedMs(Date.now() - started), 250);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className="!max-h-none !w-[min(92vw,380px)] !p-4">
          <Dialog.Head>
            <Dialog.Title>{t.gearPlanOptimizingTitle}</Dialog.Title>
          </Dialog.Head>
          <p className={dialogDescClass}>{t.gearPlanOptimizingBody}</p>
          <div className="flex flex-col items-center gap-3 py-2">
            <Hero6BombActivationSprite className="size-40 select-none" />
            <div
              className="h-1.5 w-full overflow-hidden rounded-sm border border-line bg-bg"
              role="progressbar"
              aria-valuetext={t.gearPlanOptimizingProgressAria}
              aria-label={t.gearPlanOptimizingProgressAria}
            >
              <div className="h-full w-full animate-pulse rounded-sm bg-accent/70" />
            </div>
            <p className="m-0 text-[13px] tabular-nums text-muted" role="status" aria-live="polite">
              {sub(t.gearPlanOptimizingElapsed, { time: formatElapsed(elapsedMs) })}
            </p>
          </div>
          <div className="mt-2 flex justify-end border-t border-line py-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t.gearPlanOptimizingCancel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
