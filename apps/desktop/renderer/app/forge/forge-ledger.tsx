'use client';

/**
 * Every run the app has made on the account, at the foot of the screen and collapsible. The
 * header line carries the two figures worth knowing with the table shut, so the section is worth
 * having closed.
 *
 * Each row's piece is named from the row's own def id, rarity and level rather than from a label
 * stored beside the run: a name written months ago would still print the old set word after a
 * translation changes, and would print English on the Portuguese shell.
 */
import { useMemo, useState } from 'react';
import type { ForgeHistoryResult, ForgeHistoryRow } from '@bombfarm/contracts';
import { mapInventoryViewItem, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { rarityTextClass } from '@bombfarm/game-art';
import { Button, cn, Collapsible, DataTable, EmptyState, Panel } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatAge, formatCapturedAt } from '../../lib/format';
import {
  DEFAULT_FORGE_LEDGER_SORT,
  nextForgeLedgerSort,
  sortForgeLedgerRows,
  type ForgeLedgerSort,
  type ForgeLedgerSortKey,
} from '../../lib/forge/forge-ledger-rows';
import { forgeLevel, forgeStopText, type ForgeLabels } from './forge-labels';

type Column = { key: ForgeLedgerSortKey; label: string; align: 'left' | 'right' };

const LEDGER_MAX_ROWS = 9;

function pieceOf(row: ForgeHistoryRow): InventoryViewItem | null {
  return mapInventoryViewItem({
    id: String(row.id),
    def_id: row.defId,
    rarity: row.rarity,
    level: row.itemLevel,
    upgrade: row.toUpgrade,
  });
}

export function ForgeLedger({
  history,
  labels,
  onClearHistory,
  defaultOpen = false,
}: {
  history: ForgeHistoryResult;
  labels: ForgeLabels;
  onClearHistory: () => void;
  /** Shut on arrival: the split above it is what the player came to the screen for, and the
   *  header line says how many runs and how much gold without opening anything. */
  defaultOpen?: boolean;
}) {
  const t = useCopy();
  const [sort, setSort] = useState<ForgeLedgerSort>(DEFAULT_FORGE_LEDGER_SORT);

  const pieces = useMemo(() => new Map(history.rows.map((row) => [row.id, pieceOf(row)])), [history.rows]);
  const nameOf = useMemo(() => {
    return (row: ForgeHistoryRow): string => {
      const piece = pieces.get(row.id) ?? null;
      return piece === null ? row.defId : labels.itemName(piece);
    };
  }, [pieces, labels]);
  const outcomeOf = useMemo(() => (row: ForgeHistoryRow) => forgeStopText(row.stop, t), [t]);

  const rows = useMemo(
    () => sortForgeLedgerRows(history.rows, sort, nameOf, outcomeOf),
    [history.rows, sort, nameOf, outcomeOf],
  );

  const columns: Column[] = [
    { key: 'when', label: t.forgeLedgerColumnWhen, align: 'left' },
    { key: 'item', label: t.forgeLedgerColumnItem, align: 'left' },
    { key: 'climb', label: t.forgeLedgerColumnClimb, align: 'right' },
    { key: 'outcome', label: t.forgeLedgerColumnOutcome, align: 'left' },
    { key: 'rolls', label: t.forgeLedgerColumnRolls, align: 'right' },
    { key: 'fails', label: t.forgeLedgerColumnFails, align: 'right' },
    { key: 'crits', label: t.forgeLedgerColumnCrits, align: 'right' },
    { key: 'safeJumps', label: t.forgeLedgerColumnSafeJumps, align: 'right' },
    { key: 'spent', label: t.forgeLedgerColumnGold, align: 'right' },
    { key: 'duration', label: t.forgeLedgerColumnDuration, align: 'right' },
  ];

  const empty = history.rows.length === 0;

  return (
    <Panel data-testid="forge-ledger" data-state={empty ? 'empty' : 'runs'} className="shrink-0">
      <Collapsible.Root defaultOpen={defaultOpen}>
        <Collapsible.Trigger tone="panel">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>{t.forgeLedgerTitle}</span>
            <span
              data-testid="forge-ledger-summary"
              className="text-xs font-normal tracking-normal normal-case tabular-nums text-muted"
            >
              {sub(t.forgeLedgerSummary, { runs: history.totals.runs, spent: labels.gold(history.totals.spent) })}
            </span>
          </span>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          {empty ? (
            <EmptyState title={t.forgeLedgerEmptyTitle} description={t.forgeLedgerEmptyDescription} headingLevel={3} />
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <DataTable.Root scrollable maxRows={LEDGER_MAX_ROWS}>
                <DataTable.Table>
                  <DataTable.Caption>{t.forgeLedgerCaption}</DataTable.Caption>
                  <DataTable.Head>
                    <DataTable.Row>
                      {columns.map((column) => (
                        <DataTable.Header
                          key={column.key}
                          scope="col"
                          sortable
                          col={column.key}
                          sortKey={sort.key}
                          sortDir={sort.direction}
                          onSort={(key) => { setSort(nextForgeLedgerSort(sort, key)); }}
                          align={column.align}
                        >
                          {column.label}
                        </DataTable.Header>
                      ))}
                    </DataTable.Row>
                  </DataTable.Head>
                  <DataTable.Body data-testid="forge-ledger-body">
                    {rows.map((row) => {
                      const piece = pieces.get(row.id) ?? null;
                      return (
                        <DataTable.Row key={row.id} data-testid="forge-ledger-row" data-run-id={row.id}>
                          <DataTable.RowHeader className="whitespace-nowrap">
                            {formatCapturedAt(row.finishedAt, t)}
                          </DataTable.RowHeader>
                          <DataTable.Cell nowrap>
                            <span
                              data-testid="forge-ledger-item"
                              className={cn('truncate', (piece && rarityTextClass(piece.rarityIdx)) ?? 'text-ink')}
                            >
                              {nameOf(row)}
                            </span>
                          </DataTable.Cell>
                          <DataTable.Cell align="right" nowrap numeric data-testid="forge-ledger-climb">
                            {`${forgeLevel(row.fromUpgrade)} → ${forgeLevel(row.toUpgrade)}`}
                          </DataTable.Cell>
                          <DataTable.Cell nowrap data-testid="forge-ledger-outcome">
                            {outcomeOf(row)}
                          </DataTable.Cell>
                          <DataTable.Cell align="right" numeric>
                            {labels.count(row.rolls)}
                          </DataTable.Cell>
                          <DataTable.Cell align="right" numeric className={row.fails > 0 ? 'text-down' : undefined}>
                            {labels.count(row.fails)}
                          </DataTable.Cell>
                          <DataTable.Cell align="right" numeric>
                            {labels.count(row.crits)}
                          </DataTable.Cell>
                          <DataTable.Cell align="right" numeric>
                            {labels.count(row.safeJumps)}
                          </DataTable.Cell>
                          <DataTable.Cell align="right" numeric>
                            {labels.gold(row.spent)}
                          </DataTable.Cell>
                          <DataTable.Cell align="right" nowrap numeric>
                            {formatAge(row.durationMs, t)}
                          </DataTable.Cell>
                        </DataTable.Row>
                      );
                    })}
                  </DataTable.Body>
                </DataTable.Table>
              </DataTable.Root>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                <span data-testid="forge-ledger-totals" className="tabular-nums text-muted">
                  {sub(t.forgeLedgerTotals, {
                    runs: history.totals.runs,
                    spent: labels.gold(history.totals.spent),
                    rolls: labels.count(history.totals.rolls),
                    fails: labels.count(history.totals.fails),
                  })}
                </span>
                <Button type="button" variant="text" className="ml-auto" data-testid="forge-ledger-clear" onClick={onClearHistory}>
                  {t.forgeLedgerClear}
                </Button>
              </div>
            </div>
          )}
        </Collapsible.Panel>
      </Collapsible.Root>
    </Panel>
  );
}
