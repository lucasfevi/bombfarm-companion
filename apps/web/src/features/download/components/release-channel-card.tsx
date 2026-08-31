import { cn } from '@bombfarm/ui';

export function ReleaseChannelCard({
  title,
  note,
  current,
}: {
  title: string;
  note: string;
  current?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-bg px-3.5 py-2.5',
        current && 'border-gold/45 bg-[color-mix(in_oklch,var(--gold)_9%,transparent)]',
      )}
    >
      <span
        className={cn(
          'block font-mono text-[11px] tracking-wider uppercase',
          current ? 'text-gold' : 'text-ink',
        )}
      >
        {title}
      </span>
      <span className="font-mono text-[10.5px] text-muted">{note}</span>
    </div>
  );
}
