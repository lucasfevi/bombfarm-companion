'use client';

import { sub, subNodes, useCopy } from '../../lib/copy';
import type { ForgeQueueSettings } from '../../lib/forge/forge-queue-settings';
import type { ForgeQueuePricing, ForgeQueueRow } from '../../lib/forge/forge-queue-view';
import { ForgeGold } from './forge-gold';
import { forgeLevel, type ForgeLabels } from './forge-labels';
import { forgeQueueRunsOutText, forgeQueueStonesUsedText } from './forge-queue-stones';

export function ForgeQueueConfirmBody({
  rows,
  pricing,
  settings,
  labels,
}: {
  rows: readonly ForgeQueueRow[];
  pricing: ForgeQueuePricing;
  settings: ForgeQueueSettings;
  labels: ForgeLabels;
}) {
  const t = useCopy();
  const head = rows[0] ?? null;
  const essence =
    pricing.essence === null ? null : <strong className="font-semibold text-ink">{labels.count(Math.round(pricing.essence))}</strong>;
  const gold =
    pricing.gold === null ? null : (
      <strong className="font-semibold text-ink">
        <ForgeGold>{labels.gold(Math.round(pricing.gold))}</ForgeGold>
      </strong>
    );
  const stonesUsed = forgeQueueStonesUsedText(pricing, labels);
  const runsOut = forgeQueueRunsOutText(rows, pricing, settings, labels, t);
  const estimate =
    gold === null || essence === null || head === null
      ? t.forgeQueueConfirmNoEstimate
      : rows.length === 1
        ? subNodes(t.forgeQueueConfirmOne, {
            item: head.item === null ? head.piece.itemId : labels.itemName(head.item),
            target: forgeLevel(head.piece.target),
            gold,
            essence,
          })
        : subNodes(t.forgeQueueConfirmMany, { count: rows.length, gold, essence });
  return (
    <>
      {estimate}
      {stonesUsed === null ? null : (
        <span data-testid="forge-queue-confirm-stones" className="mt-2 block">
          {sub(t.forgeQueueConfirmStones, { stones: stonesUsed })}
        </span>
      )}
      {runsOut === null ? null : (
        <span data-testid="forge-queue-confirm-runs-out" className="mt-2 block text-warn">
          {runsOut}
        </span>
      )}
    </>
  );
}
