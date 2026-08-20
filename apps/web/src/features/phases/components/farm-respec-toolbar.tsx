'use client';

import { Button } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { selectFarmRespecGate, usePlannerStore } from '@/shared/stores';
import { FarmRespecHeadline } from './farm-respec-headline';

/**
 * The settled toolbar row: the Optimize `Button` plus the headline slot. Lives inside the
 * ranking board, above the column headers and below the rotation pool / filters block. Renders
 * NOTHING unless the Tier 1 gate has something to say — no reserved empty band; the board is
 * visually unchanged from today until then. `usePlannerStore(selectFarmRespecGate)` is used
 * WITHOUT `useShallow` — the selector returns a stable identity on a cache hit, and the board's
 * own row selector already relies on that same contract.
 */
export function FarmRespecToolbar({ t }: { t: Strings }) {
  const gate = usePlannerStore(selectFarmRespecGate);
  const status = usePlannerStore((state) => state.farmRespecStatus);
  const panelOpen = usePlannerStore((state) => state.farmRespecPanelOpen);
  const runFarmRespec = usePlannerStore((state) => state.runFarmRespec);

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
        onClick={runFarmRespec}
      >
        {busy ? t.farmRespecOptimizeBusy : t.farmRespecOptimize}
      </Button>
      {degraded ? (
        <span className="text-[12px] text-muted">{t.farmRespecGateFailed}</span>
      ) : gate.result ? (
        <FarmRespecHeadline t={t} result={gate.result} />
      ) : null}
    </div>
  );
}
