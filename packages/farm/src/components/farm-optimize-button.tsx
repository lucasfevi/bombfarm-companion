'use client';

import { Button } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';
import { farmFieldControlClass } from './farm-ranking-filters';

/**
 * The Optimize button, the last item on the board's filter row. It asks nothing of the board: it
 * hands the player to the host's Optimizer screen, which is where every recommendation — points,
 * gear moves, forges — is made. Reaching that screen is routing, so the host supplies it as a
 * callback.
 *
 * Sized to the row's 26px control band and bottom-aligned to it, so it sits on the same line as
 * the controls beside it rather than floating against their labels.
 */
export function FarmOptimizeButton({
  t,
  onOpenOptimizer,
}: {
  t: FarmCopy;
  onOpenOptimizer: () => void;
}) {
  return (
    <div className={`${farmFieldControlClass} self-end`}>
      <Button
        type="button"
        variant="primary"
        data-testid="farm-optimize"
        className="h-full min-w-28 py-0"
        onClick={onOpenOptimizer}
      >
        {t.farmOptimize}
      </Button>
    </div>
  );
}
