/**
 * The queue as a screen draws it: each piece paired with the bag row it names, and what the
 * climb ahead of it should cost under the queue's settings and the stones in the bag. The store
 * keeps only the piece and its target — the bag is the truth about where the piece stands now —
 * so this is settled on every read, the way `resolveForgeScreen` settles the Forge screen's own
 * piece.
 */
import {
  FORGE_GUARANTEED,
  FORGE_ITEM_LEVELS,
  forgeForecast,
  type ForgeForecast,
  type ForgeOptions,
  type ForgeStones,
} from '@bombfarm/domain/forge';
import { mapInventoryViewItem, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { ForgeQueuePiece } from './forge-queue-reducer';
import { queueStones, type ForgeQueueSettings } from './forge-queue-settings';

export type ForgeQueueRow = {
  readonly piece: ForgeQueuePiece;
  /** Null while the bag has not been read, or once the piece has left it. */
  readonly item: InventoryViewItem | null;
};

export function resolveForgeQueue(pieces: readonly ForgeQueuePiece[], gear: readonly InventoryViewItem[]): ForgeQueueRow[] {
  const byId = new Map(gear.map((item) => [item.id, item]));
  return pieces.map((piece) => ({ piece, item: byId.get(piece.itemId) ?? null }));
}

const STONE_EPSILON = 1e-9;

export type ForgeQueuePricedRow = {
  /** Null when the piece cannot be priced — no bag row, nothing left to climb, or a level the
   *  forge table does not know — or when the queue is expected to have stopped before it. */
  readonly spend: { readonly gold: number; readonly essence: number; readonly stones: readonly number[] } | null;
  /** False for a piece after the one the queue is expected to stop at. */
  readonly reached: boolean;
};

export type ForgeQueuePricing = {
  readonly rows: readonly ForgeQueuePricedRow[];
  /** Summed over the rows that could be priced; null when none could. */
  readonly gold: number | null;
  readonly essence: number | null;
  /** Expected Chance Stones the counted spend uses, by rarity. */
  readonly stonesNeeded: readonly number[];
  readonly stonesOwned: readonly number[];
  /** The first piece whose stones the stock does not cover, or null when it covers them all. */
  readonly runsOutAt: number | null;
};

function coveredShare(needed: readonly number[], remaining: readonly number[]): number {
  let share = 1;
  needed.forEach((count, rarity) => {
    if (count <= STONE_EPSILON) return;
    share = Math.min(share, Math.max(0, remaining[rarity] ?? 0) / count);
  });
  return share;
}

function scaled(forecast: ForgeForecast, share: number) {
  return {
    gold: forecast.gold * share,
    essence: forecast.essence * share,
    stones: forecast.stones.map((count) => count * share),
  };
}

/** The run stops on the first roll that wants a stone it lacks, so the climb below that is spent regardless. */
function lastTargetBeforeStones(stones: ForgeStones | undefined, upgrade: number, target: number): number {
  for (let at = Math.max(upgrade + 1, FORGE_GUARANTEED + 1); at <= target; at++) {
    if ((stones?.[at - 1] ?? null) !== null) return at - 1;
  }
  return target;
}

/**
 * What the queue should cost under its settings and the stones in the bag. Pieces are walked in
 * queue order carrying the stock: a piece the stock covers takes its expected stones out of it;
 * the first one it does not cover is where it runs out. With the stop on, the queue halts there —
 * that piece counts its climb up to the first roll wanting a stone in full, and the rest of it for the share
 * the stock covers, and the pieces after it are not reached; with it off, the
 * piece is the covered share priced with stones and the rest without, and every later piece
 * needing a spent kind is priced the same way against what is left.
 */
export function priceForgeQueue(
  rows: readonly ForgeQueueRow[],
  settings: ForgeQueueSettings,
  owned: readonly number[],
): ForgeQueuePricing {
  const stones = queueStones(settings);
  const remaining = [...owned];
  const needed = owned.map(() => 0);
  let runsOutAt: number | null = null;
  let halted = false;
  let gold: number | null = null;
  let essence: number | null = null;

  const priced: ForgeQueuePricedRow[] = [];
  for (const [index, { piece, item }] of rows.entries()) {
    if (halted) {
      priced.push({ spend: null, reached: false });
      continue;
    }
    if (item === null || item.upgrade >= piece.target || !FORGE_ITEM_LEVELS.includes(item.level)) {
      priced.push({ spend: null, reached: true });
      continue;
    }
    const forgeFor = (options: ForgeOptions, target = piece.target) =>
      forgeForecast(item.upgrade, target, item.level, item.rarityIdx, item.forgeFails ?? 0, options);
    const withStones = forgeFor({ ...(stones === undefined ? {} : { stones }), protect: settings.scroll });
    const share = coveredShare(withStones.stones, remaining);
    let spend: NonNullable<ForgeQueuePricedRow['spend']>;
    if (share >= 1 - STONE_EPSILON) {
      spend = scaled(withStones, 1);
    } else {
      runsOutAt ??= index;
      if (settings.stopWhenOutOfStones) {
        halted = true;
        const lastFree = lastTargetBeforeStones(stones, item.upgrade, piece.target);
        const free = lastFree > item.upgrade ? forgeFor({ protect: settings.scroll }, lastFree) : null;
        const covered = scaled(withStones, share);
        spend =
          free === null
            ? covered
            : {
                gold: free.gold + share * Math.max(0, withStones.gold - free.gold),
                essence: free.essence + share * Math.max(0, withStones.essence - free.essence),
                stones: covered.stones,
              };
      } else {
        const without = scaled(forgeFor({ protect: settings.scroll }), 1 - share);
        const covered = scaled(withStones, share);
        spend = {
          gold: covered.gold + without.gold,
          essence: covered.essence + without.essence,
          stones: covered.stones,
        };
      }
    }
    spend.stones.forEach((count, rarity) => {
      remaining[rarity] = Math.max(0, (remaining[rarity] ?? 0) - count);
      needed[rarity] = (needed[rarity] ?? 0) + count;
    });
    gold = (gold ?? 0) + spend.gold;
    essence = (essence ?? 0) + spend.essence;
    priced.push({ spend, reached: true });
  }

  return { rows: priced, gold, essence, stonesNeeded: needed, stonesOwned: [...owned], runsOutAt };
}

/** Where every piece in the bag stands, for the queue's sync. */
export function bagUpgrades(gear: readonly InventoryViewItem[]): Map<string, number> {
  return new Map(gear.map((item) => [item.id, item.upgrade]));
}

/**
 * Where one piece stands in the bag as the account payload carries it now, decoded the way the
 * bag itself is. `gone` is a bag that was read and no longer holds the piece; `unknown` is a
 * payload with no bag to read, which says nothing about the piece.
 */
export type BagStanding = { kind: 'held'; upgrade: number } | { kind: 'gone' } | { kind: 'unknown' };

export function bagStandingOf(rawItems: readonly unknown[] | undefined, itemId: string): BagStanding {
  if (rawItems === undefined) return { kind: 'unknown' };
  const raw = rawItems.find((candidate) => (candidate as { id?: unknown } | null)?.id === itemId);
  const upgrade = raw === undefined ? undefined : mapInventoryViewItem(raw)?.upgrade;
  return upgrade === undefined ? { kind: 'gone' } : { kind: 'held', upgrade };
}
