import { FORGE_GUARANTEED, forgeStonePp, type ForgeStones } from '@bombfarm/domain/forge';

export const MAX_STONE_RANGES = 4;

/** A stored range: a Chance Stone rarity (or none) for every target up to `upTo`. The last range
 *  always runs to the plan's target, whatever its stored `upTo` says. */
export type ForgeStoneRange = { readonly upTo: number; readonly rarity: number | null };

/** The ranges as they apply to one climb: contiguous, from the first target to the plan's. */
export type ResolvedStoneRange = { readonly from: number; readonly to: number; readonly rarity: number | null };

export function resolveStoneRanges(
  ranges: readonly ForgeStoneRange[],
  upgrade: number,
  target: number,
): ResolvedStoneRange[] {
  const first = upgrade + 1;
  if (first > target) return [];
  if (ranges.length === 0) return [{ from: first, to: target, rarity: null }];
  const resolved: ResolvedStoneRange[] = [];
  let from = first;
  ranges.forEach((range, index) => {
    if (from > target) return;
    const to = index === ranges.length - 1 ? target : Math.min(range.upTo, target);
    if (to < from) return;
    resolved.push({ from, to, rarity: range.rarity });
    from = to + 1;
  });
  return resolved;
}

function stored(resolved: readonly ResolvedStoneRange[]): ForgeStoneRange[] {
  return resolved.map((range) => ({ upTo: range.to, rarity: range.rarity }));
}

export function setStoneRarity(
  ranges: readonly ForgeStoneRange[],
  upgrade: number,
  target: number,
  index: number,
  rarity: number | null,
): ForgeStoneRange[] {
  const resolved = resolveStoneRanges(ranges, upgrade, target);
  if (index < 0 || index >= resolved.length) return [...ranges];
  return stored(resolved.map((range, at) => (at === index ? { ...range, rarity } : range)));
}

/** Moves the end of a range that has a successor; the successor's start follows, and it keeps at
 *  least its last target. */
export function setStoneRangeEnd(
  ranges: readonly ForgeStoneRange[],
  upgrade: number,
  target: number,
  index: number,
  upTo: number,
): ForgeStoneRange[] {
  const resolved = resolveStoneRanges(ranges, upgrade, target);
  if (index < 0 || index >= resolved.length - 1) return [...ranges];
  const range = resolved[index];
  const next = resolved[index + 1];
  if (range === undefined || next === undefined) return [...ranges];
  const clamped = Math.max(range.from, Math.min(Math.round(upTo), next.to - 1));
  return stored(resolved.map((each, at) => (at === index ? { ...each, to: clamped } : each)));
}

/** Splits the widest range in two, the new upper half keeping the same stone, so the forecast does not move. */
export function addStoneRange(
  ranges: readonly ForgeStoneRange[],
  upgrade: number,
  target: number,
): ForgeStoneRange[] {
  const resolved = resolveStoneRanges(ranges, upgrade, target);
  if (resolved.length >= MAX_STONE_RANGES) return [...ranges];
  let widest = -1;
  resolved.forEach((range, index) => {
    const width = range.to - range.from;
    const best = resolved[widest];
    if (width >= 1 && (best === undefined || width >= best.to - best.from)) widest = index;
  });
  const split = resolved[widest];
  if (split === undefined) return [...ranges];
  const lowerEnd = split.from + Math.ceil((split.to - split.from + 1) / 2) - 1;
  return stored(resolved.flatMap((range, index) => (index === widest ? [{ ...range, to: lowerEnd }, range] : [range])));
}

/** Drops one range; the one after it, or the one before when it was the last, takes over its targets. */
export function removeStoneRange(
  ranges: readonly ForgeStoneRange[],
  upgrade: number,
  target: number,
  index: number,
): ForgeStoneRange[] {
  const resolved = resolveStoneRanges(ranges, upgrade, target);
  if (resolved.length <= 1 || index < 0 || index >= resolved.length) return [...ranges];
  return stored(resolved.filter((_, at) => at !== index));
}

/** What the forecast reads: the stone for each target, indexed by target - 1; undefined when none is chosen. */
export function stonesByTarget(resolved: readonly ResolvedStoneRange[]): ForgeStones | undefined {
  if (resolved.every((range) => range.rarity === null)) return undefined;
  const byTarget: (number | null)[] = [];
  for (const range of resolved) {
    for (let at = range.from; at <= range.to; at++) byTarget[at - 1] = range.rarity;
  }
  return Array.from(byTarget, (rarity) => rarity ?? null);
}

/** The stone chosen for `target`, if any; says nothing about whether the game would accept it. */
export function stoneForTarget(resolved: readonly ResolvedStoneRange[], target: number): number | null {
  return resolved.find((range) => range.from <= target && target <= range.to)?.rarity ?? null;
}

/** Whether the chance at `target` on a clean streak is lifted by its stone. */
export function stonePpForTarget(resolved: readonly ResolvedStoneRange[], target: number): number {
  const rarity = stoneForTarget(resolved, target);
  return rarity === null || target <= FORGE_GUARANTEED ? 0 : forgeStonePp(rarity);
}

/** A stone chosen only for targets that always land is a stone the game would refuse every time. */
export function stonesCanBeUsed(resolved: readonly ResolvedStoneRange[]): boolean {
  return resolved.some((range) => range.rarity !== null && range.to > FORGE_GUARANTEED);
}

export function stoneKey(stones: ForgeStones | undefined): string {
  return stones === undefined ? '' : stones.map((rarity) => rarity ?? '-').join('');
}
