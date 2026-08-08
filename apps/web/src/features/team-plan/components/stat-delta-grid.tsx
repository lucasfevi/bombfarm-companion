'use client';

import { Fragment } from 'react';
import { cn } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

export type StatDeltaRow = { key: string; label: string; before: number; after: number };

/** Generic Stat / Before / After / Δ grid — reused by the per-hero stat and point breakdowns. */
export function StatDeltaGrid({
  t,
  rows,
  decimals = 2,
}: {
  t: Strings;
  rows: StatDeltaRow[];
  decimals?: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-[12px]">
      <span className="text-muted">{t.colStat}</span>
      <span className="text-right text-muted">{t.teamPlanColBefore}</span>
      <span className="text-right text-muted">{t.teamPlanColAfter}</span>
      <span className="text-right text-muted">{t.teamPlanColDelta}</span>
      {rows.map((row) => {
        const delta = row.after - row.before;
        return (
          <Fragment key={row.key}>
            <span>{row.label}</span>
            <span className="text-right tabular-nums">{formatNumber(row.before, decimals)}</span>
            <span className="text-right tabular-nums">{formatNumber(row.after, decimals)}</span>
            <span
              className={cn(
                'text-right tabular-nums',
                delta < 0 ? 'text-down' : delta > 0 ? 'text-up' : undefined,
              )}
            >
              {delta >= 0 ? '+' : ''}
              {formatNumber(delta, decimals)}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
