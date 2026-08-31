import type { Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';

export function ReplicaChrome({ lang }: { lang: Lang }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 bg-surface px-3 py-2">
      <div className="flex gap-1">
        <span className="rounded-sm bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] px-2 py-1 font-mono text-[10px] tracking-wider text-accent uppercase">
          Live
        </span>
        <span className="px-2 py-1 font-mono text-[10px] tracking-wider text-muted uppercase">
          Inventory
        </span>
        <span className="px-2 py-1 font-mono text-[10px] tracking-wider text-muted uppercase">
          Settings
        </span>
      </div>
      <span className="flex items-center gap-2 font-mono text-[10px] text-up">
        <span className="size-1.5 rounded-full bg-up" />
        {liveLabel('liveStatusLiveLabel', lang)}
      </span>
    </div>
  );
}
