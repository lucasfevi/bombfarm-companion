'use client';

import type { GearBonuses } from '@bombfarm/domain/gear';
import type { Strings } from '@/shared/i18n';
import { DataTable } from '@bombfarm/ui';
import { gearBonusRows, formatBonus } from '../model/gear-bonus-rows';

/** Display-only totals — transposed ledger (stats as columns) so wide screens fill like a scoreboard. */
export function GearTotalsTable({
  current,
  clone,
  t,
  formatNumber,
}: {
  current: GearBonuses;
  clone?: GearBonuses;
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
}) {
  const comparing = Boolean(clone);
  const cols = gearBonusRows(current, t, clone);

  return (
    <DataTable.Root className="min-w-0 overflow-x-auto">
      <DataTable.Table className="text-left">
        <DataTable.Caption>{t.gearTotals}</DataTable.Caption>
        <DataTable.Head>
          <DataTable.Row className="border-b border-line">
            <DataTable.Header className="w-26">
              <span className="sr-only">{t.gearTotals}</span>
            </DataTable.Header>
            {cols.map((col) => (
              <DataTable.Header key={col.key} align="right" className="min-w-19">
                {col.label}
              </DataTable.Header>
            ))}
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          <DataTable.Row
            className={
              comparing
                ? 'border-b border-[color-mix(in_oklch,var(--line)_55%,transparent)]'
                : undefined
            }
          >
            <DataTable.RowHeader className="py-2 pr-3 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
              {comparing ? t.compareCurrent : t.gearTotals}
            </DataTable.RowHeader>
            {cols.map((col) => (
              <DataTable.Cell
                key={col.key}
                align="right"
                numeric
                className="py-2 font-mono text-sm font-semibold text-ink"
              >
                {formatBonus(formatNumber, col.current, col.percent)}
              </DataTable.Cell>
            ))}
          </DataTable.Row>
          {comparing ? (
            <>
              <DataTable.Row className="border-b border-[color-mix(in_oklch,var(--line)_55%,transparent)]">
                <DataTable.RowHeader className="py-2 pr-3 text-[11px] font-bold tracking-[0.06em] text-accent uppercase">
                  {t.compareAlt}
                </DataTable.RowHeader>
                {cols.map((col) => (
                  <DataTable.Cell
                    key={col.key}
                    align="right"
                    numeric
                    className="py-2 font-mono text-sm font-semibold text-accent"
                  >
                    {formatBonus(formatNumber, col.clone ?? 0, col.percent)}
                  </DataTable.Cell>
                ))}
              </DataTable.Row>
              <DataTable.Row>
                <DataTable.RowHeader className="border-b-0 py-2 pr-3 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
                  Δ
                </DataTable.RowHeader>
                {cols.map((col) => (
                  <DataTable.Cell
                    key={col.key}
                    align="right"
                    numeric
                    className={`border-b-0 py-2 font-mono text-xs font-medium ${
                      (col.delta ?? 0) >= 0 ? 'text-up' : 'text-down'
                    }`}
                  >
                    {(col.delta ?? 0) >= 0 ? '+' : ''}
                    {formatNumber(col.delta ?? 0, 1)}
                    {col.percent ? '%' : ''}
                  </DataTable.Cell>
                ))}
              </DataTable.Row>
            </>
          ) : null}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
