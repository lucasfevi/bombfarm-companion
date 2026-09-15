'use client';

import { Button } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';

/**
 * The toolbar row: the Optimize `Button`, and nothing else. Lives inside the ranking board,
 * above the column headers and below the rotation pool / filters block.
 *
 * It renders unconditionally, and it asks nothing of the board: the button hands the player to
 * the host's Optimizer screen, which is where every recommendation — points, gear moves, forges —
 * is made. Reaching that screen is routing, so the host supplies it as a callback.
 */
export function FarmOptimizeToolbar({
  t,
  onOpenOptimizer,
}: {
  t: FarmCopy;
  onOpenOptimizer: () => void;
}) {
  return (
    <div
      data-testid="farm-optimize-toolbar"
      className="mb-3 flex flex-wrap items-center gap-3 border-t border-line pt-3"
    >
      <Button
        type="button"
        variant="primary"
        data-testid="farm-optimize"
        className="min-w-32"
        onClick={onOpenOptimizer}
      >
        {t.farmOptimize}
      </Button>
    </div>
  );
}
