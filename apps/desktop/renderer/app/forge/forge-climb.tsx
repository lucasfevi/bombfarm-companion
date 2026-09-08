'use client';

/**
 * The climb as it happened — the chart beside its rolls-by-rung tally. Drawn under a live run and
 * again under the result that run produced, so the shape behind the totals is still on screen
 * while the reader judges what the spend bought.
 */
import { useMemo, type ReactNode } from 'react';
import type { ForgeStepEvent } from '@bombfarm/contracts';
import { DataTable } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { rungTally } from '../../lib/forge/forge-run-reducer';
import { ForgeChart } from './forge-chart';
import { ForgeGold } from './forge-gold';
import { forgeRungLabel } from './forge-labels';

/** The rail's two-column measure: a wide side, then a narrow one. Both the finished result's
 *  header row and the climb below it are drawn in one of these, so the two break on the same edge
 *  and read as a single grid — a component rather than a shared class string, so the measure has
 *  one definition and cannot drift between them. */
export function ForgeRailRow({ testId, children }: { testId?: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {children}
    </div>
  );
}

export function ForgeClimb({
  from,
  target,
  steps,
  pending,
  gold,
}: {
  from: number;
  target: number;
  steps: readonly ForgeStepEvent[];
  pending: boolean;
  gold: (amount: number) => string;
}) {
  const t = useCopy();
  const rows = useMemo(() => rungTally(steps), [steps]);

  return (
    <ForgeRailRow testId="forge-climb">
      <div className="flex min-w-0 flex-col">
        <ForgeChart start={from} target={target} steps={steps} pending={pending} />
      </div>

      <DataTable.Root>
        <DataTable.Table data-testid="forge-tally">
          <DataTable.Caption>{t.forgeRailTallyCaption}</DataTable.Caption>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header scope="col">{t.forgeRailTallyRung}</DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.forgeRailTallyRolls}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.forgeRailTallyFails}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.forgeRailTallyGold}
              </DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {rows.map((row) => (
              <DataTable.Row key={row.from} data-testid="forge-tally-row">
                <DataTable.RowHeader>
                  <span data-testid="forge-tally-rung" className="font-mono tabular-nums">
                    {forgeRungLabel(row)}
                  </span>
                </DataTable.RowHeader>
                <DataTable.Cell align="right" numeric data-testid="forge-tally-rolls">
                  {row.rolls}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric className={row.fails > 0 ? 'text-down' : undefined} data-testid="forge-tally-fails">
                  {row.fails}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric data-testid="forge-tally-gold">
                  <ForgeGold>{gold(row.gold)}</ForgeGold>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </ForgeRailRow>
  );
}
