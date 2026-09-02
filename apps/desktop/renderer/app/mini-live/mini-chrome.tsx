import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';

/** `-webkit-app-region` has no Tailwind utility and isn't a standard CSS property TypeScript knows. */
interface AppRegionStyle extends CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const DRAG_STYLE: AppRegionStyle = { WebkitAppRegion: 'drag' };
const NO_DRAG_STYLE: AppRegionStyle = { WebkitAppRegion: 'no-drag' };

export function MiniChrome({ onClose, gear }: { onClose: () => void; gear: ReactNode }) {
  const t = useCopy();

  return (
    <header
      data-testid="mini-live-chrome"
      className="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-line/55 px-1"
      style={DRAG_STYLE}
    >
      <div className="flex items-center gap-1" style={NO_DRAG_STYLE}>
        {gear}
        <button
          type="button"
          data-testid="mini-live-close"
          aria-label={t.miniLiveCloseAria}
          onClick={onClose}
          className="grid size-7 place-items-center rounded-sm border-0 bg-transparent text-muted transition-colors hover:text-ink focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Icon name="x-mark" size="sm" />
        </button>
      </div>
    </header>
  );
}
