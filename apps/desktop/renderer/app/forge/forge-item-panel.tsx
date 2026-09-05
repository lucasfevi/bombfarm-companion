'use client';

import { useMemo } from 'react';
import { ItemIcon, rarityTextClass } from '@bombfarm/game-art';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { cn, DataTable, EmptyState, Panel, PanelHeader } from '@bombfarm/ui';
import { useCopy, useLocale } from '../../lib/copy';
import { forgeLevel, forgeStatRows, type ForgeLabels } from './forge-labels';

const CHANGE_CLASS = {
  up: 'text-up',
  down: 'text-down',
  none: 'text-muted',
} as const;

export function ForgeItemPanel({
  item,
  wearerName,
  target,
  labels,
}: {
  item: InventoryViewItem | null;
  wearerName: string | null;
  target: number;
  labels: ForgeLabels;
}) {
  const t = useCopy();
  const { lang, locale } = useLocale();
  const rows = useMemo(
    () => (item === null ? [] : forgeStatRows(item.stats, item.upgrade, target, lang, locale)),
    [item, target, lang, locale],
  );

  if (item === null) {
    return (
      <Panel data-testid="forge-item-panel" data-state="empty">
        <PanelHeader title={t.forgeItemTitle} />
        <EmptyState title={t.forgePickTitle} description={t.forgePickDescription} headingLevel={3} />
      </Panel>
    );
  }

  return (
    <Panel data-testid="forge-item-panel" data-state="item" data-item-id={item.id} className="flex flex-col gap-3">
      <PanelHeader title={t.forgeItemTitle} />
      <div className="flex items-center gap-3">
        <ItemIcon item={item} size="xl" showLevel={false} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            data-testid="forge-item-name"
            className={cn('truncate', 'text-sm', 'font-semibold', rarityTextClass(item.rarityIdx) ?? 'text-ink')}
          >
            {labels.itemName(item)}
          </span>
          <span className="text-xs text-muted">{labels.itemMeta(item)}</span>
          <span data-testid="forge-item-whereabouts" className="text-xs text-muted">
            {labels.whereabouts(item, wearerName)}
          </span>
        </div>
      </div>

      <DataTable.Root>
        <DataTable.Table>
          <DataTable.Caption>{t.forgeStatsCaption}</DataTable.Caption>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header scope="col">{t.farmStatColumn}</DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {forgeLevel(item.upgrade)}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {forgeLevel(target)}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.forgeColumnChange}
              </DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {rows.map((row) => (
              <DataTable.Row key={row.code} data-testid="forge-stat-row">
                <DataTable.RowHeader>{row.label}</DataTable.RowHeader>
                <DataTable.Cell align="right" numeric>
                  {row.now}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric>
                  {row.target}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric className={CHANGE_CLASS[row.direction]}>
                  {row.change}
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>

      <p className="m-0 text-xs text-muted">{labels.statsNote(item.upgrade, target)}</p>
    </Panel>
  );
}
