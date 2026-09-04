/**
 * The plan panel's state — the target rung and the two optional limits — as a pure reducer, and
 * the hook a screen reads it through. The forecast behind the panel's facts is derived here too,
 * memoised per piece and target, so stepping the target costs one value iteration and one seeded
 * run of simulated climbs and nothing else.
 */
import { useCallback, useMemo, useReducer } from 'react';
import {
  FORGE_ITEM_LEVELS,
  FORGE_MAX,
  FORGE_SAFE,
  forgeForecast,
  forgeGoldPercentile,
} from '@bombfarm/domain/forge';

export type ForgePlan = {
  /** The piece the target belongs to. A different piece starts from its own default target. */
  readonly itemId: string | null;
  readonly target: number;
  readonly maxGold: number | null;
  readonly attempts: number | null;
};

export type ForgePlanAction =
  | { kind: 'step'; itemId: string; upgrade: number; delta: 1 | -1 }
  | { kind: 'maxGold'; text: string }
  | { kind: 'attempts'; text: string };

export const INITIAL_FORGE_PLAN: ForgePlan = { itemId: null, target: FORGE_SAFE, maxGold: null, attempts: null };

/** The safe jump while the piece is below it; otherwise the very next rung. */
export function defaultForgeTarget(upgrade: number): number {
  return upgrade < FORGE_SAFE ? FORGE_SAFE : Math.min(upgrade + 1, FORGE_MAX);
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

/** The plan as it applies to `item`: its own target while it is the piece the plan was made for,
 *  the default target otherwise. The limits carry across pieces — a budget is the player's. */
export function forgePlanFor(plan: ForgePlan, item: { id: string; upgrade: number } | null): ForgePlan {
  if (item === null) return { ...plan, itemId: null, target: FORGE_SAFE };
  if (plan.itemId === item.id) return { ...plan, target: clampForgeTarget(plan.target, item.upgrade) };
  return { ...plan, itemId: item.id, target: defaultForgeTarget(item.upgrade) };
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
  }
}

export type ForgePlanForecast = {
  rolls: number;
  safeJumps: number;
  gold: number;
  /** What a run of bad luck costs — the 90th percentile of a seeded simulation. */
  badRunGold: number;
};

/** One seed for every forecast, so the same plan prints the same bad-run figure every time. */
const FORECAST_SEED = 0x5eed;
const BAD_RUN_PERCENTILE = 0.9;

export function forgePlanForecast(
  upgrade: number,
  target: number,
  level: number,
  rarityIdx: number,
): ForgePlanForecast | null {
  if (!FORGE_ITEM_LEVELS.includes(level)) return null;
  if (!Number.isInteger(rarityIdx) || rarityIdx < 0) return null;
  if (!Number.isInteger(upgrade) || upgrade < 0 || upgrade >= target || target > FORGE_MAX) return null;
  try {
    const expected = forgeForecast(upgrade, target, level, rarityIdx);
    const badRunGold = forgeGoldPercentile(upgrade, target, level, rarityIdx, BAD_RUN_PERCENTILE, FORECAST_SEED);
    return { ...expected, badRunGold };
  } catch {
    return null;
  }
}

export type ForgePlanItem = { id: string; upgrade: number; level: number; rarityIdx: number };

export function useForgePlan(item: ForgePlanItem | null) {
  const [state, dispatch] = useReducer(forgePlanReducer, INITIAL_FORGE_PLAN);
  const plan = useMemo(() => forgePlanFor(state, item), [state, item]);

  const forecast = useMemo(
    () =>
      item === null ? null : forgePlanForecast(item.upgrade, plan.target, item.level, item.rarityIdx),
    [item, plan.target],
  );

  const stepTarget = useCallback(
    (delta: 1 | -1) => {
      if (item === null) return;
      dispatch({ kind: 'step', itemId: item.id, upgrade: item.upgrade, delta });
    },
    [item],
  );
  const setMaxGold = useCallback((text: string) => {
    dispatch({ kind: 'maxGold', text });
  }, []);
  const setAttempts = useCallback((text: string) => {
    dispatch({ kind: 'attempts', text });
  }, []);

  return { plan, forecast, stepTarget, setMaxGold, setAttempts };
}
