'use client';

import { useMemo } from 'react';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { cn, StatList, type StatListItem } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { deconstructGroups } from '../../lib/deconstruct/deconstruct-groups';
import type { DeconstructLabels } from './deconstruct-labels';

const REGION_CLASS = cn(
  'shrink',
  'max-h-[7.125rem]',
  '[@media(max-height:820px)]:max-h-[4.75rem]',
  'overflow-y-auto',
  'border-t',
  'border-line',
  '[scrollbar-gutter:stable]',
);

const LIST_CLASS = cn('gap-0', '[&_>div]:py-px', '[&_dt]:leading-4', '[&_dd]:leading-4');

/** Capped at six rows, four on a window under 820px tall: the tile region above absorbs the rows, but a short window has no spare height for them. */
export function DeconstructBatchGroups({ items, labels }: { items: readonly InventoryViewItem[]; labels: DeconstructLabels }) {
  const t = useCopy();
  const rows = useMemo<StatListItem[]>(
    () =>
      deconstructGroups(items, labels.groupName).map((group) => ({
        id: group.id,
        label: (
          <span data-testid="deconstruct-group-row" data-group={group.id} data-count={group.count}>
            {group.label}
          </span>
        ),
        value: labels.count(group.count),
      })),
    [items, labels],
  );

  return (
    <div data-testid="deconstruct-batch-groups" className={REGION_CLASS}>
      <StatList items={rows} aria-label={t.deconstructGroupsLabel} className={LIST_CLASS} />
    </div>
  );
}
