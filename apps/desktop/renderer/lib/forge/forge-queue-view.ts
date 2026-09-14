/**
 * The queue as a screen draws it: each piece paired with the bag row it names, and what the
 * climb ahead of it should cost. The store keeps only the piece and its target — the bag is the
 * truth about where the piece stands now — so this is settled on every read, the way
 * `resolveForgeScreen` settles the Forge screen's own piece.
 */
import { FORGE_ITEM_LEVELS, forgeForecast, type ForgeForecast } from '@bombfarm/domain/forge';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { ForgeQueuePiece } from './forge-queue-reducer';

export type ForgeQueueRow = {
  readonly piece: ForgeQueuePiece;
  /** Null while the bag has not been read, or once the piece has left it. */
  readonly item: InventoryViewItem | null;
  /** Null when the piece cannot be priced — no bag row, nothing left to climb, or a level the
   *  forge table does not know. */
  readonly forecast: ForgeForecast | null;
};

function forecastFor(item: InventoryViewItem, target: number): ForgeForecast | null {
  if (item.upgrade >= target || !FORGE_ITEM_LEVELS.includes(item.level)) return null;
  return forgeForecast(item.upgrade, target, item.level, item.rarityIdx);
}

export function resolveForgeQueue(pieces: readonly ForgeQueuePiece[], gear: readonly InventoryViewItem[]): ForgeQueueRow[] {
  const byId = new Map(gear.map((item) => [item.id, item]));
  return pieces.map((piece) => {
    const item = byId.get(piece.itemId) ?? null;
    return { piece, item, forecast: item === null ? null : forecastFor(item, piece.target) };
  });
}

/** Summed over the rows that could be priced; null when none could. */
export function forgeQueueExpectedGold(rows: readonly ForgeQueueRow[]): number | null {
  let total: number | null = null;
  for (const row of rows) {
    if (row.forecast === null) continue;
    total = (total ?? 0) + row.forecast.gold;
  }
  return total;
}

/** Where every piece in the bag stands, for the queue's sync. */
export function bagUpgrades(gear: readonly InventoryViewItem[]): Map<string, number> {
  return new Map(gear.map((item) => [item.id, item.upgrade]));
}
