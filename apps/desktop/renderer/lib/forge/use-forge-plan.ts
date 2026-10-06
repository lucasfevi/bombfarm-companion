/**
 * The plan panel's state — the target rung and the two optional limits — as a pure reducer, and
 * the hook a screen reads it through. The state itself is held by the screen's store so it
 * outlives a tab change; this hook only derives from it and hands changes back. The forecast
 * behind the panel's facts is derived here too, memoised per piece standing and target, so
 * stepping the target costs a few exact solves and nothing else.
 */
import { useCallback, useMemo } from 'react';
import { collectionFromSave } from '@bombfarm/domain/model';
import {
  FORGE_ITEM_LEVELS,
  FORGE_MAX,
  FORGE_GUARANTEED,
  forgeForecast,
  forgeGoldQuantile,
  forgeProtectable,
  type ForgeForecast,
  type ForgeStones,
} from '@bombfarm/domain/forge';
import {
  addStoneRange,
  removeStoneRange,
  resolveStoneRanges,
  setStoneRangeEnd,
  setStoneRarity,
  stoneKey,
  stonesByTarget,
  type ForgeStoneRange,
} from './forge-stones';

export type ForgePlan = {
  /** The piece the target belongs to. A different piece starts from its own default target. */
  readonly itemId: string | null;
  readonly target: number;
  readonly maxGold: number | null;
  readonly attempts: number | null;
  /** The Chance Stone chosen for each stretch of targets; empty is no stones. Belongs to the piece, like the target. */
  readonly stones: readonly ForgeStoneRange[];
};

export type ForgeStoneEdit =
  | { kind: 'stoneRarity'; index: number; rarity: number | null }
  | { kind: 'stoneEnd'; index: number; upTo: number }
  | { kind: 'stoneAdd' }
  | { kind: 'stoneRemove'; index: number };

export type ForgePlanAction =
  | { kind: 'step'; itemId: string; upgrade: number; delta: 1 | -1 }
  | { kind: 'maxGold'; text: string }
  | { kind: 'attempts'; text: string }
  | { kind: 'stoneRarity'; itemId: string; upgrade: number; index: number; rarity: number | null }
  | { kind: 'stoneEnd'; itemId: string; upgrade: number; index: number; upTo: number }
  | { kind: 'stoneAdd'; itemId: string; upgrade: number }
  | { kind: 'stoneRemove'; itemId: string; upgrade: number; index: number };

export const INITIAL_FORGE_PLAN: ForgePlan = {
  itemId: null,
  target: FORGE_GUARANTEED,
  maxGold: null,
  attempts: null,
  stones: [],
};

/** The last rung that always lands while the piece is below it; otherwise the very next rung. */
export function defaultForgeTarget(upgrade: number): number {
  return upgrade < FORGE_GUARANTEED ? FORGE_GUARANTEED : Math.min(upgrade + 1, FORGE_MAX);
}

export function clampForgeTarget(target: number, upgrade: number): number {
  const lowest = Math.min(upgrade + 1, FORGE_MAX);
  return Math.max(lowest, Math.min(FORGE_MAX, Math.round(target)));
}

/** Digits only; anything else, and an empty field, is "no limit". */
export function parseForgeLimit(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (digits === '') return null;
  const value = Number(digits);
  return value > 0 ? value : null;
}

/** The plan as it applies to `item`: its own target and stones while it is the piece the plan was
 *  made for, the default target and no stones otherwise. The limits carry across pieces — a budget
 *  is the player's. */
export function forgePlanFor(plan: ForgePlan, item: { id: string; upgrade: number } | null): ForgePlan {
  if (item === null) return { ...plan, itemId: null, target: FORGE_GUARANTEED, stones: [] };
  if (plan.itemId === item.id) return { ...plan, target: clampForgeTarget(plan.target, item.upgrade) };
  return { ...plan, itemId: item.id, target: defaultForgeTarget(item.upgrade), stones: [] };
}

function editStones(
  plan: ForgePlan,
  piece: { itemId: string; upgrade: number },
  edit: (stones: readonly ForgeStoneRange[], upgrade: number, target: number) => ForgeStoneRange[],
): ForgePlan {
  const current = forgePlanFor(plan, { id: piece.itemId, upgrade: piece.upgrade });
  return { ...current, stones: edit(current.stones, piece.upgrade, current.target) };
}

export function forgePlanReducer(plan: ForgePlan, action: ForgePlanAction): ForgePlan {
  switch (action.kind) {
    case 'step': {
      const current = forgePlanFor(plan, { id: action.itemId, upgrade: action.upgrade });
      return { ...current, target: clampForgeTarget(current.target + action.delta, action.upgrade) };
    }
    case 'maxGold':
      return { ...plan, maxGold: parseForgeLimit(action.text) };
    case 'attempts':
      return { ...plan, attempts: parseForgeLimit(action.text) };
    case 'stoneRarity':
      return editStones(plan, action, (stones, upgrade, target) =>
        setStoneRarity(stones, upgrade, target, action.index, action.rarity),
      );
    case 'stoneEnd':
      return editStones(plan, action, (stones, upgrade, target) =>
        setStoneRangeEnd(stones, upgrade, target, action.index, action.upTo),
      );
    case 'stoneAdd':
      return editStones(plan, action, addStoneRange);
    case 'stoneRemove':
      return editStones(plan, action, (stones, upgrade, target) => removeStoneRange(stones, upgrade, target, action.index));
  }
}

export type ForgePlanForecast = {
  rolls: number;
  gold: number;
  essence: number;
  /** The same climb with the Protection Scroll ticked on every rung that offers it; null when none does. */
  protected: ForgeForecast | null;
  /** Expected Chance Stones spent per rarity on the plain climb. */
  stones: readonly number[];
  /** What a run of bad luck costs — the 90th percentile of the climb's gold. */
  badRunGold: number;
};

const BAD_RUN_PERCENTILE = 0.9;

function computeForgePlanForecast(
  upgrade: number,
  target: number,
  level: number,
  rarityIdx: number,
  chanceBonus = 0,
  fails = 0,
  stones?: ForgeStones,
): ForgePlanForecast | null {
  if (!FORGE_ITEM_LEVELS.includes(level)) return null;
  if (!Number.isInteger(rarityIdx) || rarityIdx < 0) return null;
  if (!Number.isInteger(upgrade) || upgrade < 0 || upgrade >= target || target > FORGE_MAX) return null;
  try {
    const bonus = stones === undefined ? { bonus: chanceBonus } : { bonus: chanceBonus, stones };
    const expected = forgeForecast(upgrade, target, level, rarityIdx, fails, bonus);
    const protectedClimb = forgeProtectable(target)
      ? forgeForecast(upgrade, target, level, rarityIdx, fails, { ...bonus, protect: true })
      : null;
    const badRunGold = forgeGoldQuantile(upgrade, target, level, rarityIdx, BAD_RUN_PERCENTILE, fails, bonus);
    return { ...expected, protected: protectedClimb, badRunGold };
  } catch {
    return null;
  }
}

const FORECAST_CACHE_LIMIT = 64;
const forecastCache = new Map<string, ForgePlanForecast | null>();

export function forgePlanForecast(
  upgrade: number,
  target: number,
  level: number,
  rarityIdx: number,
  chanceBonus = 0,
  fails = 0,
  stones?: ForgeStones,
): ForgePlanForecast | null {
  const key = `${String(upgrade)}|${String(target)}|${String(level)}|${String(rarityIdx)}|${String(chanceBonus)}|${String(fails)}|${stoneKey(stones)}`;
  if (forecastCache.has(key)) return forecastCache.get(key) ?? null;
  const forecast = computeForgePlanForecast(upgrade, target, level, rarityIdx, chanceBonus, fails, stones);
  if (forecastCache.size >= FORECAST_CACHE_LIMIT) forecastCache.delete(forecastCache.keys().next().value as string);
  forecastCache.set(key, forecast);
  return forecast;
}

export type ForgePlanItem = { id: string; upgrade: number; level: number; rarityIdx: number; forgeFails?: number };

/**
 * The Collection's forge axis as a chance addend. Its unit on the wire is unmeasured; it is read
 * as percentage points, like the other Collection axes, and an absent block is no bonus.
 */
export function forgeCollectionBonus(skills: unknown): number {
  if (typeof skills !== 'object' || skills === null) return 0;
  const totals = (skills as { totals?: unknown }).totals;
  if (typeof totals !== 'object' || totals === null) return 0;
  return Math.max(0, collectionFromSave(totals as Record<string, unknown>).forgePct) / 100;
}

/** `plan` is the stored plan already resolved against `item`; `onPlanChange` puts the next one
 *  back where it came from. */
export function useForgePlan(
  item: ForgePlanItem | null,
  plan: ForgePlan,
  onPlanChange: (next: ForgePlan) => void,
  chanceBonus = 0,
) {
  const upgrade = item?.upgrade;
  const level = item?.level;
  const rarityIdx = item?.rarityIdx;
  const fails = item?.forgeFails ?? 0;
  const stoneRanges = useMemo(
    () => (upgrade === undefined ? [] : resolveStoneRanges(plan.stones, upgrade, plan.target)),
    [upgrade, plan.stones, plan.target],
  );
  const stones = useMemo(() => stonesByTarget(stoneRanges), [stoneRanges]);
  const forecast = useMemo(
    () =>
      upgrade === undefined || level === undefined || rarityIdx === undefined
        ? null
        : forgePlanForecast(upgrade, plan.target, level, rarityIdx, chanceBonus, fails, stones),
    [upgrade, level, rarityIdx, fails, plan.target, chanceBonus, stones],
  );

  const dispatch = useCallback(
    (action: ForgePlanAction) => {
      onPlanChange(forgePlanReducer(plan, action));
    },
    [plan, onPlanChange],
  );

  const stepTarget = useCallback(
    (delta: 1 | -1) => {
      if (item === null) return;
      dispatch({ kind: 'step', itemId: item.id, upgrade: item.upgrade, delta });
    },
    [item, dispatch],
  );
  const setMaxGold = useCallback(
    (text: string) => {
      dispatch({ kind: 'maxGold', text });
    },
    [dispatch],
  );
  const setAttempts = useCallback(
    (text: string) => {
      dispatch({ kind: 'attempts', text });
    },
    [dispatch],
  );

  const editStoneRanges = useCallback(
    (action: ForgeStoneEdit) => {
      if (item === null) return;
      dispatch({ ...action, itemId: item.id, upgrade: item.upgrade });
    },
    [item, dispatch],
  );

  return { forecast, stoneRanges, stepTarget, setMaxGold, setAttempts, editStoneRanges };
}
