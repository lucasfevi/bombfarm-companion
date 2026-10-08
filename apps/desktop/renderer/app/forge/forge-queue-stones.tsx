'use client';

import { cn } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../../lib/copy';
import type { ForgeQueueSettings } from '../../lib/forge/forge-queue-settings';
import type { ForgeQueuePricing, ForgeQueueRow } from '../../lib/forge/forge-queue-view';
import type { ForgeLabels } from './forge-labels';
import { StoneIcon } from './forge-stone-art';

const SHOWN_AT_LEAST = 0.005;

function neededRarities(pricing: ForgeQueuePricing): number[] {
  const rarities: number[] = [];
  pricing.stonesNeeded.forEach((count, rarity) => {
    if (count > SHOWN_AT_LEAST) rarities.push(rarity);
  });
  return rarities;
}

export function forgeQueueRunsOutText(
  rows: readonly ForgeQueueRow[],
  pricing: ForgeQueuePricing,
  settings: ForgeQueueSettings,
  labels: ForgeLabels,
  t: Copy,
): string | null {
  if (pricing.runsOutAt === null) return null;
  const row = rows[pricing.runsOutAt];
  if (row === undefined) return null;
  const item = row.item === null ? row.piece.itemId : labels.itemName(row.item);
  return sub(settings.stopWhenOutOfStones ? t.forgeQueueStonesStop : t.forgeQueueStonesRoll, { item });
}

export function forgeQueueStonesUsedText(pricing: ForgeQueuePricing, labels: ForgeLabels): string | null {
  const rarities = neededRarities(pricing);
  if (rarities.length === 0) return null;
  return rarities.map((rarity) => `${labels.rolls(pricing.stonesNeeded[rarity] ?? 0)} ${labels.rarityName(rarity)}`).join(' · ');
}

/** The stones the queue should use against the stones held, one row for each kind, and the line
 *  saying where the stock runs out when it does. Silent when the queue uses no stones. */
export function ForgeQueueStonesUse({
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
  const rarities = neededRarities(pricing);
  const runsOut = forgeQueueRunsOutText(rows, pricing, settings, labels, t);
  if (rarities.length === 0 && runsOut === null) return null;
  return (
    <div data-testid="forge-queue-stones" className="flex flex-col gap-1">
      {rarities.map((rarity) => {
        const expected = pricing.stonesNeeded[rarity] ?? 0;
        const held = pricing.stonesOwned[rarity] ?? 0;
        return (
          <span key={rarity} data-testid="forge-queue-stones-kind" data-rarity={rarity} className="flex items-center gap-1.5 text-xs">
            <StoneIcon rarity={rarity} small />
            <span className="text-muted">{sub(t.forgeFactStones, { rarity: labels.rarityName(rarity) })}</span>
            <span className={cn('ml-auto', 'tabular-nums', expected > held + 1e-9 ? 'text-warn' : 'text-ink')}>
              {sub(t.forgeStonesUse, { expected: labels.rolls(expected), owned: labels.count(held) })}
            </span>
          </span>
        );
      })}
      {runsOut === null ? null : (
        <span data-testid="forge-queue-stones-runs-out" className="text-[11px] text-warn">
          {runsOut}
        </span>
      )}
    </div>
  );
}
