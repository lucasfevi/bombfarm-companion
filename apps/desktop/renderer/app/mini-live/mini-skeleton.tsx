import { useCopy } from '../../lib/copy';

/**
 * What the window shows while its renderer starts. The window is revealed the moment it exists
 * rather than at first paint, so this is the frame the player actually sees on the click, and it
 * has to read as "opening" — panels already drawn with their em-dash placeholders would instead
 * claim the game sent nothing.
 *
 * It draws panel-shaped blocks rather than a spinner so the window does not change character when
 * the real sections replace it, and it deliberately does not drive the growth-axis fit: the
 * window keeps the size the player last left it until real content has something to measure.
 */
export function MiniSkeleton() {
  const t = useCopy();

  return (
    <div
      data-testid="mini-live-skeleton"
      role="status"
      aria-label={t.shellLoadingLabel}
      className="flex min-h-0 min-w-0 flex-1 animate-pulse flex-col gap-2 overflow-hidden p-2"
    >
      <div className="h-20 shrink-0 rounded-md border border-line/55 bg-surface" />
      <div className="h-20 shrink-0 rounded-md border border-line/55 bg-surface" />
    </div>
  );
}
