import { Icon } from '@bombfarm/ui';

/**
 * The compact window's header, drawn: a 32px bar carrying a layout gear and a close button,
 * right-aligned, and nothing else. The second window has no tab strip and no status line — the
 * full-size one's chrome is a different drawing and cannot be reused here.
 */
export function MiniWindowChrome() {
  return (
    <div className="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-line/55 px-1 text-muted">
      <span className="grid size-7 place-items-center rounded-sm">
        <Icon name="layout-grid" size="sm" />
      </span>
      <span className="grid size-7 place-items-center rounded-sm">
        <Icon name="x-mark" size="sm" />
      </span>
    </div>
  );
}
