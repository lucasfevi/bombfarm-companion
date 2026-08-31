'use client';

import { BrandMark, cn } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import {
  DOUBLE_CLICK_LOOP_SECONDS,
  doubleClickFrameAt,
} from '../model/step-illustrations';
import { useLoopClock } from '../model/use-loop-clock';
import { CursorArrow } from './cursor-arrow';

/**
 * The downloaded file as it sits in Explorer, being double-clicked.
 *
 * Windows shows the app's own icon on the installer, so this uses the same mark the header does.
 * The filename wraps rather than truncates: it is the thing the reader is looking for in their
 * Downloads folder, and half of it is no use.
 */
export function InstallFileTile({ t, fileName }: { t: Strings; fileName: string | null }) {
  const elapsed = useLoopClock(DOUBLE_CLICK_LOOP_SECONDS);
  const frame = doubleClickFrameAt(elapsed);

  return (
    <div
      aria-hidden="true"
      className="mt-4 rounded-lg border border-line bg-bg px-4 py-5"
    >
      <div
        className={cn(
          'relative mx-auto flex w-fit max-w-full flex-col items-center gap-2 rounded-md border px-4 py-3 transition-colors duration-150',
          frame.opening
            ? 'border-accent bg-[color-mix(in_oklch,var(--accent)_16%,transparent)]'
            : 'border-transparent bg-[color-mix(in_oklch,var(--surface)_70%,transparent)]',
        )}
      >
        <span className={cn('transition-transform duration-100', frame.pressed && 'scale-95')}>
          <BrandMark size={40} />
        </span>
        <span className="max-w-[22ch] text-center font-mono text-[10.5px] leading-snug break-all text-muted">
          {fileName ?? t.downloadInstallerGenericName}
        </span>
        <span
          className="pointer-events-none absolute top-1/2 left-1/2"
          style={{
            transform: `translate(${String(frame.offsetX)}px, ${String(frame.offsetY)}px)`,
          }}
        >
          <CursorArrow pressed={frame.pressed} />
        </span>
      </div>
    </div>
  );
}
