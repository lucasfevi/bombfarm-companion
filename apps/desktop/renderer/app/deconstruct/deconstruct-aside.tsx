'use client';

import type { ReactNode } from 'react';
import { DECONSTRUCT_BATCH_MAX, type DeconstructBatchSummary } from '@bombfarm/domain/deconstruct';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { Button, cn, Panel, PanelHeader, StatList, Tooltip, type StatListItem } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { DeconstructBatchTiles } from './deconstruct-batch-tiles';
import {
  BLANK,
  deconstructHintText,
  deconstructReasonText,
  deconstructWarnings,
  type DeconstructButtonReason,
  type DeconstructHint,
  type DeconstructLabels,
} from './deconstruct-labels';

const STATS_WIDE_CLASS = cn(
  '@min-[27.5rem]:grid-cols-2',
  '@min-[27.5rem]:gap-x-6',
  '@min-[27.5rem]:gap-y-1',
  '@min-[27.5rem]:[&_>div:nth-child(3)]:border-b-0',
  '@min-[27.5rem]:[&_>div:nth-child(3)]:pb-0',
);

/** A warning that is not in play keeps its line and drops out of sight, so the Burn button under
 *  it never moves when a batch gains or loses the thing the line warns about. */
function Warning({ testId, active, text }: { testId: string; active: boolean; text: string }) {
  return (
    <p
      data-testid={testId}
      data-active={active ? 'true' : 'false'}
      aria-hidden={active ? undefined : true}
      className={cn('m-0', 'text-xs', 'leading-[1.45]', 'text-warn', !active && 'invisible')}
    >
      {text}
    </p>
  );
}

export function DeconstructAside({
  items,
  summary,
  hidden,
  balance,
  reason,
  hint,
  burning,
  labels,
  onFill,
  onClear,
  onBurn,
  onRemove,
  result,
}: {
  /** The ticked items in the order they were ticked, whatever the filters show. */
  items: readonly InventoryViewItem[];
  summary: DeconstructBatchSummary;
  /** Ticked rows the current filters leave out of the list. */
  hidden: number;
  /** The essence balance on the pinned account, `null` when the read carries none. */
  balance: number | null;
  reason: DeconstructButtonReason;
  hint: DeconstructHint | null;
  burning: boolean;
  labels: DeconstructLabels;
  onFill: () => void;
  onClear: () => void;
  onBurn: () => void;
  onRemove: (itemId: string) => void;
  /** Drawn over the foot of the tile region, so what a burn came to adds no height to the column. */
  result: ReactNode;
}) {
  const t = useCopy();
  const warnings = deconstructWarnings(summary, t, labels);

  const facts: StatListItem[] = [
    {
      id: 'selected',
      label: t.deconstructSelectedLabel,
      value: (
        <span data-testid="deconstruct-selected">
          {sub(t.deconstructSelectedOf, { count: summary.count, max: DECONSTRUCT_BATCH_MAX })}
        </span>
      ),
    },
    {
      id: 'essence',
      label: t.deconstructEssenceLabel,
      value: <span data-testid="deconstruct-essence">{labels.signedCount(summary.essence)}</span>,
    },
    {
      id: 'balance',
      label: t.deconstructBalanceLabel,
      value: <span data-testid="deconstruct-balance">{balance === null ? BLANK : labels.count(balance)}</span>,
    },
    {
      id: 'balance-after',
      label: t.deconstructBalanceAfterLabel,
      value: (
        <span data-testid="deconstruct-balance-after">
          {balance === null ? BLANK : labels.count(balance + summary.essence)}
        </span>
      ),
    },
  ];

  const empty = summary.count === 0;

  return (
    <Panel data-testid="deconstruct-batch-panel" className="flex flex-1 flex-col gap-2">
      <PanelHeader title={t.deconstructBatchTitle} className="mb-0" />
      <StatList items={facts} aria-label={t.deconstructBatchTitle} className={STATS_WIDE_CLASS} />

      <div className="relative flex min-h-[5.8rem] flex-[1_1_0px] flex-col">
        <DeconstructBatchTiles items={items} labels={labels} disabled={burning} onRemove={onRemove} />
        {result}
      </div>

      <p
        data-testid="deconstruct-hidden-note"
        data-active={hidden > 0 ? 'true' : 'false'}
        aria-hidden={hidden > 0 ? undefined : true}
        className={cn('m-0', 'text-xs', 'leading-[1.45]', 'text-muted', hidden === 0 && 'invisible')}
      >
        {sub(t.deconstructHiddenNote, { count: labels.count(hidden) })}
      </p>

      <div className="flex flex-col gap-1.5">
        <Warning testId="deconstruct-warn-forged" active={warnings.forged.active} text={warnings.forged.text} />
        <Warning testId="deconstruct-warn-rare" active={warnings.rare.active} text={warnings.rare.text} />
      </div>

      <p
        data-testid="deconstruct-hint"
        className={cn('m-0', 'min-h-[2.4em]', '@min-[27.5rem]:min-h-[1.45em]', 'text-xs', 'leading-[1.45]', 'text-muted')}
      >
        {hint === null ? '' : deconstructHintText(hint, t, labels)}
      </p>

      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          {/* The trigger is the wrapper, not the button: a tooltip trigger drops `disabled`, and the
              button must stay inert while a burn is in flight. */}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger render={<span className="inline-flex" />}>
                <Button type="button" variant="default" data-testid="deconstruct-fill" disabled={burning} onClick={onFill}>
                  {t.deconstructFill}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0">{t.deconstructFillTip}</p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          <Button type="button" variant="ghost" data-testid="deconstruct-clear" disabled={burning || empty} onClick={onClear}>
            {t.deconstructClear}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-w-0 flex-1"
            data-testid="deconstruct-burn"
            data-reason={reason}
            disabled={reason !== 'ready'}
            onClick={onBurn}
          >
            {t.deconstructBurn}
          </Button>
        </div>
        <span data-testid="deconstruct-burn-reason" className="text-[11px] text-muted">
          {deconstructReasonText(reason, t)}
        </span>
      </div>

      <p data-testid="deconstruct-batch-footnote" className="m-0 text-[11px] leading-[1.45] text-muted">
        {t.deconstructBatchFootnote}
      </p>
    </Panel>
  );
}
