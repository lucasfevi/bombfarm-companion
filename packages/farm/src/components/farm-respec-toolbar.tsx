'use client';

import { Button } from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';
import type { FarmCopy } from '../copy';
import type { FarmRespecGate } from '../core';
import type { FarmRespecStatus } from '../model/farm-respec-view';
import { FarmRespecHeadline } from './farm-respec-headline';

export type FarmRespecToolbarData = {
  gate: FarmRespecGate;
  status: FarmRespecStatus;
  panelOpen: boolean;
};

/**
 * The settled toolbar row: the Optimize `Button` plus the headline slot. Lives inside the
 * ranking board, above the column headers and below the rotation pool / filters block. Renders
 * NOTHING unless the first-tier gate has something to say — no reserved empty band; the board is
 * visually unchanged until then.
 */
export function FarmRespecToolbar({
  t,
  lang,
  data,
  onOptimize,
}: {
  t: FarmCopy;
  lang: Lang;
  data: FarmRespecToolbarData;
  onOptimize: () => void;
}) {
  const { gate, status, panelOpen } = data;

  // Below the gain threshold (or no-roster / no-heroes-enabled), nothing renders — no reserved
  // empty band. The only visibility input read here is the gate's own shouldSurface flag, which
  // is gain alone; the payback figure is reported elsewhere but never gates this decision.
  const degraded = gate.reason === 'gate-failed';
  if (!degraded && !gate.shouldSurface) return null;

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
      {degraded ? (
        <span className="text-[12px] text-muted">{t.farmRespecGateFailed}</span>
      ) : gate.result ? (
        <FarmRespecHeadline t={t} lang={lang} result={gate.result} />
      ) : null}
    </div>
  );
}
