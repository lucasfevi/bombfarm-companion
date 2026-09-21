/** The desktop Live tab wears the game connection as a dot at its corner; the replica draws the
 *  same dot in the live state, and no sentence beside the tabs. */
export function ReplicaChrome() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 bg-surface px-3 py-2">
      <div className="flex gap-1">
        <span className="relative rounded-sm bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] px-2 py-1 font-mono text-[10px] tracking-wider text-accent uppercase">
          Live
          <span aria-hidden data-testid="replica-live-mark" className="absolute right-0.5 bottom-0.5 size-1.5 rounded-full bg-up ring-2 ring-surface" />
        </span>
        <span className="px-2 py-1 font-mono text-[10px] tracking-wider text-muted uppercase">
          Inventory
        </span>
        <span className="px-2 py-1 font-mono text-[10px] tracking-wider text-muted uppercase">
          Settings
        </span>
      </div>
    </div>
  );
}
