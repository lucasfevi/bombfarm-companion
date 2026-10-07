import { useMemo } from 'react';
import { priceForgeQueue, type ForgeQueuePricing, type ForgeQueueRow } from './forge-queue-view';
import type { ForgeQueueSettings } from './forge-queue-settings';
import { useForgeQueueSettings } from './forge-queue-settings-store';

export function useForgeQueuePricing(
  rows: readonly ForgeQueueRow[],
  ownedStones: readonly number[],
): { settings: ForgeQueueSettings; pricing: ForgeQueuePricing } {
  const settings = useForgeQueueSettings();
  const pricing = useMemo(() => priceForgeQueue(rows, settings, ownedStones), [rows, settings, ownedStones]);
  return { settings, pricing };
}
