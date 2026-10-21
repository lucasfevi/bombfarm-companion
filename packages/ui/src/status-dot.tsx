export type StatusDotTone = 'live' | 'warn' | 'down' | 'muted';

export type StatusDotProps = {
  tone: StatusDotTone;
  label: string;
  /** Announce changes to the label politely. */
  live?: boolean;
};

const toneClass: Record<StatusDotTone, string> = {
  live: 'bg-up shadow-[0_0_0_3px_color-mix(in_oklch,var(--up)_22%,transparent)]',
  warn: 'bg-warn',
  down: 'bg-down',
  muted: 'bg-muted',
};

export function StatusDot({ tone, label, live }: StatusDotProps) {
  return (
    <span className="flex items-center gap-3" {...(live ? { 'aria-live': 'polite' as const } : {})}>
      <span className={`size-2 flex-none rounded-full ${toneClass[tone]}`} aria-hidden="true"></span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
