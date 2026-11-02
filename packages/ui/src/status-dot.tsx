import type { ReactNode } from 'react';

export type StatusDotTone = 'live' | 'warn' | 'down' | 'muted';

export type StatusDotProps = {
  tone: StatusDotTone;
  label: ReactNode;
  /** Announce changes to the label politely. */
  live?: boolean;
  /** Colour the label text by the dot's tone, not just the dot. */
  colorLabel?: boolean;
  /** Set on the root element. */
  id?: string;
  /** Data attributes land on the root element too. */
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};

const toneClass: Record<StatusDotTone, string> = {
  live: 'bg-up shadow-[0_0_0_3px_color-mix(in_oklch,var(--up)_22%,transparent)]',
  warn: 'bg-warn',
  down: 'bg-down',
  muted: 'bg-muted',
};

const labelToneClass: Record<StatusDotTone, string> = {
  live: 'text-up',
  warn: 'text-warn',
  down: 'text-down',
  muted: 'text-muted',
};

export function StatusDot({ tone, label, live, colorLabel, ...rootProps }: StatusDotProps) {
  return (
    <span
      className="flex items-center gap-3"
      {...(live ? { 'aria-live': 'polite' as const } : {})}
      {...rootProps}
    >
      <span className={`size-2 flex-none rounded-full ${toneClass[tone]}`} aria-hidden="true"></span>
      <span className={colorLabel ? `tabular-nums ${labelToneClass[tone]}` : 'tabular-nums'}>{label}</span>
    </span>
  );
}
