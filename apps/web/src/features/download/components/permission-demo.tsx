'use client';

import { cn } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { PERMISSION_LOOP_SECONDS, permissionFrameAt } from '../model/step-illustrations';
import { useLoopClock } from '../model/use-loop-clock';
import { CursorArrow } from './cursor-arrow';

/**
 * The permission switch in Settings, turned off and back on.
 *
 * The off beat is the point: the line under it flips to "nothing to show". Someone who withdraws
 * the permission and then wonders why the app is empty has already been shown the answer here.
 */
export function PermissionDemo({ t }: { t: Strings }) {
  const elapsed = useLoopClock(PERMISSION_LOOP_SECONDS);
  const frame = permissionFrameAt(elapsed);

  return (
    <div aria-hidden="true" className="mt-4 rounded-lg border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-[color-mix(in_oklch,var(--surface)_70%,transparent)] px-3 py-2.5">
        <span className="min-w-0 text-[11.5px] leading-snug text-ink">
          {t.downloadPermissionRowLabel}
        </span>
        {/* The cursor is anchored to the switch it clicks, so it lands on it at any card width. */}
        <span className="relative shrink-0">
          <span
            className={cn(
              'relative block h-4 w-7 rounded-full transition-colors duration-200',
              frame.allowed ? 'bg-accent' : 'bg-line',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-3 rounded-full bg-bg transition-[left] duration-200',
                frame.allowed ? 'left-3.5' : 'left-0.5',
              )}
            />
          </span>
          <span
            className="pointer-events-none absolute top-1/2 left-1/2"
            style={{
              transform: `translate(${String(frame.offsetX - 2)}px, ${String(frame.offsetY - 2)}px)`,
            }}
          >
            <CursorArrow pressed={frame.pressed} />
          </span>
        </span>
      </div>

      <div className="mt-2 rounded-md border border-line bg-bg-2 px-3 py-2.5">
        {frame.allowed ? (
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-up uppercase">
            <span className="size-1.5 rounded-full bg-up" />
            {t.downloadPermissionOnLine}
          </span>
        ) : (
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-warn uppercase">
            <span className="size-1.5 rounded-full bg-warn" />
            {t.downloadPermissionOffLine}
          </span>
        )}
      </div>
    </div>
  );
}
