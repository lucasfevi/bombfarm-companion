'use client';

import { memo } from 'react';
import { FORGE_SAFE } from '@bombfarm/domain/forge';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import {
  ItemIdentity,
  inventoryTableRowClass,
  inventoryTableSkippedNoteClass,
} from '@bombfarm/game-art';
import { cn, DataTable, EmptyState, Icon } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { nextForgeSort, type ForgeSort, type ForgeSortKey } from '../../lib/forge/forge-rows';
import { forgeLevel, type ForgeLabels } from './forge-labels';

type Column = { key: ForgeSortKey; label: string; align: 'left' | 'right' };

const SELECTED_ROW_CLASS = 'bg-[color-mix(in_oklch,var(--accent)_14%,var(--surface))]';

const ForgeTableRow = memo(function ForgeTableRow({
  item,
  selected,
  labels,
  selectLabel,
  onSelect,
}: {
  item: InventoryViewItem;
  selected: boolean;
  labels: ForgeLabels;
  selectLabel: string;
  onSelect: (item: InventoryViewItem) => void;
}) {
  const name = labels.itemName(item);

  return (
    <DataTable.Row
      data-testid="forge-table-row"
      data-item-id={item.id}
      data-selected={selected ? '' : undefined}
      aria-selected={selected}
      className={cn(inventoryTableRowClass, 'cursor-pointer', selected && SELECTED_ROW_CLASS)}
      onClick={() => { onSelect(item); }}
    >
      <DataTable.RowHeader>
        <button
          type="button"
          aria-label={sub(selectLabel, { item: name })}
          className="w-full cursor-pointer border-0 bg-transparent p-0 text-left text-inherit"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(item);
          }}
        >
          <span className="flex min-w-0 items-center gap-1">
            <ItemIdentity item={item} labels={labels} nameTestId="forge-row-name" className="flex-1" />
            {item.locked ? <Icon name="lock-closed" size="xs" className="shrink-0 text-muted" /> : null}
          </span>
        </button>
      </DataTable.RowHeader>
      <DataTable.Cell nowrap>{labels.slotName(item.slot)}</DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {item.level}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={cn('font-semibold', item.upgrade > FORGE_SAFE && 'text-accent')}>
        {forgeLevel(item.upgrade)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {labels.count(item.power)}
      </DataTable.Cell>
    </DataTable.Row>
  );
});

export function ForgeTable({
  rows,
  hidden,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  labels,
  filtered,
  onClearFilter,
  className,
}: {
  rows: readonly InventoryViewItem[];
  hidden: number;
  sort: ForgeSort;
  onSortChange: (next: ForgeSort) => void;
  selectedId: string | null;
  onSelect: (item: InventoryViewItem) => void;
  labels: ForgeLabels;
  /** Whether a filter is what emptied the rows, so the empty state can offer to clear it. */
  filtered: boolean;
  onClearFilter: () => void;
  className?: string | undefined;
}) {
  const t = useCopy();

  const columns: Column[] = [
    { key: 'item', label: t.inventoryGroupEquipment, align: 'left' },
    { key: 'slot', label: t.forgeColumnSlot, align: 'left' },
    { key: 'level', label: t.inventorySortLevel, align: 'right' },
    { key: 'forge', label: t.forgeColumnForge, align: 'right' },
    { key: 'power', label: t.forgeColumnPower, align: 'right' },
  ];

  if (rows.length === 0) {
    return filtered ? (
      <EmptyState
        title={t.inventoryFilterNoMatches}
        className={className}
        action={
          <button type="button" onClick={onClearFilter} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-accent">
            {t.inventoryFilterClear}
          </button>
        }
      />
    ) : (
      <EmptyState title={t.inventoryEmptyTitle} description={t.inventoryEmptyDescription} className={className} />
    );
  }

  return (
    <div className={cn('flex', 'min-h-0', 'flex-col', className)}>
      <DataTable.Root scrollable className="min-h-0 flex-1">
        <DataTable.Table>
          <DataTable.Caption>{t.forgeTableCaption}</DataTable.Caption>
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
                  onSort={(key) => { onSortChange(nextForgeSort(sort, key)); }}
                  align={column.align}
                >
                  {column.label}
                </DataTable.Header>
              ))}
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body data-testid="forge-table-body">
            {rows.map((item) => (
              <ForgeTableRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                labels={labels}
                selectLabel={t.forgeRowSelect}
                onSelect={onSelect}
              />
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
      {hidden > 0 ? (
        <p data-testid="forge-more-rows" className={inventoryTableSkippedNoteClass}>
          {sub(t.forgeMoreRows, { count: labels.count(hidden) })}
        </p>
      ) : null}
    </div>
  );
}
