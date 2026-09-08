'use client';

import { Button } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';
import type { FarmRespecStatus } from '../model/farm-respec-view';

export type FarmRespecToolbarData = {
  status: FarmRespecStatus;
  panelOpen: boolean;
};

/**
 * The settled toolbar row: the Optimize `Button`, and nothing else. Lives inside the ranking
 * board, above the column headers and below the rotation pool / filters block.
 *
 * It renders unconditionally. The board no longer runs a background estimate to decide whether
 * the control is worth offering, so there is no state in which a player can want the answer and
 * find no way to ask for it. Everything the solve has to say — the gain, the cost, the payback,
 * and the verdict that a respec is not worth making at all — is reported in the panel below,
 * after the player asks.
 */
export function FarmRespecToolbar({
  t,
  data,
  onOptimize,
}: {
  t: FarmCopy;
  data: FarmRespecToolbarData;
  onOptimize: () => void;
}) {
  const { status, panelOpen } = data;
  const busy = status === 'solving';

  return (
    <div
      data-testid="farm-respec-toolbar"
      className="mb-3 flex flex-wrap items-center gap-3 border-t border-line pt-3"
    >
      <Button
        type="button"
        variant="primary"
        data-testid="farm-respec-optimize"
        aria-busy={busy}
        aria-expanded={panelOpen}
        aria-controls="farm-respec-panel"
        disabled={busy}
        // Reserved to the longer of the idle/busy labels in both languages
        // ("Calculating…" / "Calculando…") so the busy transition never reflows the row.
        className="min-w-32"
        onClick={onOptimize}
      >
        {busy ? t.farmRespecOptimizeBusy : t.farmRespecOptimize}
      </Button>
    </div>
  );
}
