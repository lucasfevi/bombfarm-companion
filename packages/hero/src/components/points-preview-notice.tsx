'use client';

import type { ReactNode } from 'react';
import { Collapsible, cn } from '@bombfarm/ui';

const TONE_CLASS = {
  muted: 'border-line text-muted',
  warn: 'border-warn text-warn',
  up: 'border-up text-ink',
} as const;

/**
 * One Optimize-build feedback line. Mounts behind DS Collapsible so enable/disable
 * animates height instead of reserving an invisible gap. Left rail carries tone;
 * copy stays left-aligned prose, not a right-ragged footnote.
 */
export function PointsPreviewNotice({
  open,
  tone,
  children,
}: {
  open: boolean;
  tone: keyof typeof TONE_CLASS;
  children: ReactNode;
}) {
  return (
    <Collapsible.Root open={open}>
      <Collapsible.Panel>
        <p
          role="status"
          className={cn(
            'm-0 max-w-prose border-l-2 py-1 pl-2.5 text-left text-xs leading-snug',
            TONE_CLASS[tone],
          )}
        >
          {children}
        </p>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
