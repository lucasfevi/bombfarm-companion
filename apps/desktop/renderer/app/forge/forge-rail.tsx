'use client';

/**
 * The full-width slot between the toolbar and the split. Idle, it shows the last run's ledger
 * row and the running totals; with nothing to show it collapses to no height rather than leaving
 * an empty band. The run states arrive with the run itself.
 */
import { Panel } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import { forgeLevel } from './forge-labels';

export type ForgeRailLastRun = {
  itemLabel: string;
  fromUpgrade: number;
  toUpgrade: number;
  rolls: number;
  fails: number;
  spent: number;
  /** ISO-8601, when the run ended. */
  at: string;
};

export type ForgeRailIdle = {
  lastRun: ForgeRailLastRun | null;
  totals: { runs: number; spent: number } | null;
};

export function ForgeRail({ idle, gold }: { idle: ForgeRailIdle; gold: (amount: number) => string }) {
  const t = useCopy();
  const collapsed = idle.lastRun === null && idle.totals === null;

  if (collapsed) {
    return <div data-testid="forge-rail" data-state="collapsed" className="h-0 overflow-hidden" />;
  }

  return (
    <Panel data-testid="forge-rail" data-state="idle" className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
      {idle.lastRun ? (
        <span data-testid="forge-rail-last-run" className="text-ink">
          {sub(t.forgeRailLastRun, {
            item: idle.lastRun.itemLabel,
            from: forgeLevel(idle.lastRun.fromUpgrade),
            to: forgeLevel(idle.lastRun.toUpgrade),
            rolls: idle.lastRun.rolls,
            fails: idle.lastRun.fails,
            spent: gold(idle.lastRun.spent),
            age: formatCapturedAt(idle.lastRun.at, t),
          })}
        </span>
      ) : null}
      {idle.totals ? (
        <span data-testid="forge-rail-totals" className="text-muted">
          {sub(t.forgeRailTotals, { runs: idle.totals.runs, spent: gold(idle.totals.spent) })}
        </span>
      ) : null}
    </Panel>
  );
}
