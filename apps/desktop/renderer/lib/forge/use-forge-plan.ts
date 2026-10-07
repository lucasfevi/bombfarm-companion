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
  forgeSpendQuantiles,
  forgeProtectable,
  type ForgeOptions,
  type ForgeStones,
} from '@bombfarm/domain/forge';
import {
  addStoneRange,
  joinStoneRanges,
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
  /** Whether the climb pays for the Protection Scroll wherever the game offers it. Belongs to the piece, like the stones. */
  readonly scroll: boolean;
};

export type ForgeStoneEdit =
  | { kind: 'stoneRarity'; index: number; rarity: number | null }
  | { kind: 'stoneEnd'; index: number; upTo: number }
  | { kind: 'stoneAdd' }
  | { kind: 'stoneJoin' }
  | { kind: 'stoneRemove'; index: number };

export type ForgePlanAction =
  | { kind: 'step'; itemId: string; upgrade: number; delta: 1 | -1 }
  | { kind: 'maxGold'; text: string }
  | { kind: 'attempts'; text: string }
  | { kind: 'scroll'; itemId: string; upgrade: number; on: boolean }
  | { kind: 'stoneRarity'; itemId: string; upgrade: number; index: number; rarity: number | null }
  | { kind: 'stoneEnd'; itemId: string; upgrade: number; index: number; upTo: number }
  | { kind: 'stoneAdd'; itemId: string; upgrade: number }
  | { kind: 'stoneJoin'; itemId: string; upgrade: number }
  | { kind: 'stoneRemove'; itemId: string; upgrade: number; index: number };

export const INITIAL_FORGE_PLAN: ForgePlan = {
  itemId: null,
  target: FORGE_GUARANTEED,
  maxGold: null,
  attempts: null,
  stones: [],
  scroll: false,
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
  if (item === null) return { ...plan, itemId: null, target: FORGE_GUARANTEED, stones: [], scroll: false };
  if (plan.itemId === item.id) return { ...plan, target: clampForgeTarget(plan.target, item.upgrade) };
  return { ...plan, itemId: item.id, target: defaultForgeTarget(item.upgrade), stones: [], scroll: false };
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
    case 'scroll':
      return { ...forgePlanFor(plan, { id: action.itemId, upgrade: action.upgrade }), scroll: action.on };
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
    case 'stoneJoin':
      return editStones(plan, action, joinStoneRanges);
    case 'stoneRemove':
      return editStones(plan, action, (stones, upgrade, target) => removeStoneRange(stones, upgrade, target, action.index));
  }
}

export type ForgePlanFigures = {
  rolls: number;
  gold: number;
  essence: number;
  /** Expected Chance Stones spent per rarity. */
  stones: readonly number[];
  /** What a run of bad luck costs — the 90th percentile of the climb's gold. */
  badRunGold: number;
  /** The 90th percentile of the climb's essence, the scroll's included when it is on. */
  badRunEssence: number;
};

export type ForgePlanForecast = ForgePlanFigures & {
  /** The figures above are for the climb with the Protection Scroll ticked wherever it is offered. */
  scroll: boolean;
  /** The same climb the other way — without the scroll when it is on, with it when it is off; null when no rung offers it. */
  other: ForgePlanFigures | null;
};

const BAD_RUN_PERCENTILE = 0.9;

type ForgePlanPair = { plain: ForgePlanFigures; protected: ForgePlanFigures | null };

function figuresOf(
  upgrade: number,
  target: number,
  level: number,
  rarityIdx: number,
  fails: number,
  options: ForgeOptions,
): ForgePlanFigures {
  const expected = forgeForecast(upgrade, target, level, rarityIdx, fails, options);
  const badRun = forgeSpendQuantiles(upgrade, target, level, rarityIdx, BAD_RUN_PERCENTILE, fails, options);
  return { ...expected, badRunGold: badRun.gold, badRunEssence: badRun.essence };
}

function computeForgePlanPair(
  upgrade: number,
  target: number,
  level: number,
  rarityIdx: number,
  chanceBonus: number,
  fails: number,
  stones?: ForgeStones,
): ForgePlanPair | null {
  if (!FORGE_ITEM_LEVELS.includes(level)) return null;
  if (!Number.isInteger(rarityIdx) || rarityIdx < 0) return null;
  if (!Number.isInteger(upgrade) || upgrade < 0 || upgrade >= target || target > FORGE_MAX) return null;
  try {
    const bonus: ForgeOptions = stones === undefined ? { bonus: chanceBonus } : { bonus: chanceBonus, stones };
    const plain = figuresOf(upgrade, target, level, rarityIdx, fails, bonus);
    const offered = forgeProtectable(target);
    const protectedClimb = offered ? figuresOf(upgrade, target, level, rarityIdx, fails, { ...bonus, protect: true }) : null;
    return { plain, protected: protectedClimb };
  } catch {
    return null;
  }
}

const FORECAST_CACHE_LIMIT = 64;
const pairCache = new Map<string, ForgePlanPair | null>();
const forecastCache = new Map<string, ForgePlanForecast | null>();

function remember<V>(cache: Map<string, V>, key: string, value: V): void {
  if (cache.size >= FORECAST_CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
}

/** The climb priced plain, or with the Protection Scroll ticked where `scroll` asks for it and a
 *  rung offers it; the other pricing rides along so the trade-off stays on screen. */
export function forgePlanForecast(
  upgrade: number,
  target: number,
  level: number,
  rarityIdx: number,
  chanceBonus = 0,
  fails = 0,
  stones?: ForgeStones,
  scroll = false,
): ForgePlanForecast | null {
  const base = `${String(upgrade)}|${String(target)}|${String(level)}|${String(rarityIdx)}|${String(chanceBonus)}|${String(fails)}|${stoneKey(stones)}`;
  const key = `${base}|${scroll ? 'scroll' : 'plain'}`;
  if (forecastCache.has(key)) return forecastCache.get(key) ?? null;
  if (!pairCache.has(base)) {
    remember(pairCache, base, computeForgePlanPair(upgrade, target, level, rarityIdx, chanceBonus, fails, stones));
  }
  const pair = pairCache.get(base) ?? null;
  let forecast: ForgePlanForecast | null = null;
  if (pair !== null) {
    forecast =
      scroll && pair.protected !== null
        ? { ...pair.protected, scroll: true, other: pair.plain }
        : { ...pair.plain, scroll: false, other: pair.protected };
  }
  remember(forecastCache, key, forecast);
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
        : forgePlanForecast(upgrade, plan.target, level, rarityIdx, chanceBonus, fails, stones, plan.scroll),
    [upgrade, level, rarityIdx, fails, plan.target, chanceBonus, stones, plan.scroll],
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
  const setScroll = useCallback(
    (on: boolean) => {
      if (item === null) return;
      dispatch({ kind: 'scroll', itemId: item.id, upgrade: item.upgrade, on });
    },
    [item, dispatch],
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

  return { forecast, stoneRanges, stepTarget, setMaxGold, setAttempts, setScroll, editStoneRanges };
}
