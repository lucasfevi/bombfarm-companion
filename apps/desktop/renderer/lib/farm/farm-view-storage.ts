/**
 * What the farm screen remembers between visits: the rotation-pool overrides, the return-bonus
 * mode and the phase the player had selected.
 *
 * Its own key, deliberately not the web planner's. The two apps read different accounts out of
 * different stores, and sharing a key would be a claim that one screen's state is the other's.
 */
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import { DEFAULT_FARM_CONTROLS, type FarmControls } from './farm-inputs';

const FARM_VIEW_STORAGE_KEY = 'bfc-farm-view';

const RETURN_BONUS_MODES: readonly ReturnBonusMode[] = ['off', 'on', 'vip'];

export type FarmView = FarmControls & {
  /** The phase whose detail the player had open. Post-compute — it never invalidates a snapshot. */
  readonly selectedPhase: number | null;
};

export const DEFAULT_FARM_VIEW: FarmView = { ...DEFAULT_FARM_CONTROLS, selectedPhase: null };

function normalizeReturnBonus(value: unknown): ReturnBonusMode {
  return RETURN_BONUS_MODES.find((mode) => mode === value) ?? DEFAULT_FARM_VIEW.farmReturnBonus;
}

function normalizePoolOverrides(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_FARM_VIEW.farmPoolOverrides;
  }
  const out: Record<string, boolean> = {};
  for (const [heroId, enabled] of Object.entries(value)) {
    if (typeof enabled === 'boolean') out[heroId] = enabled;
  }
  return out;
}

function normalizeSelectedPhase(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

function normalizeFarmView(value: unknown): FarmView {
  if (typeof value !== 'object' || value === null) return DEFAULT_FARM_VIEW;
  const raw = value as Record<string, unknown>;
  return {
    farmPoolOverrides: normalizePoolOverrides(raw.farmPoolOverrides),
    farmReturnBonus: normalizeReturnBonus(raw.farmReturnBonus),
    selectedPhase: normalizeSelectedPhase(raw.selectedPhase),
  };
}

/** Never throws and never returns a partial record: an absent, unparseable or half-written value
 *  reads as the defaults. */
export function loadFarmView(): FarmView {
  try {
    const stored = window.localStorage.getItem(FARM_VIEW_STORAGE_KEY);
    if (stored === null) return DEFAULT_FARM_VIEW;
    const parsed: unknown = JSON.parse(stored);
    return normalizeFarmView(parsed);
  } catch {
    return DEFAULT_FARM_VIEW;
  }
}

export function saveFarmView(view: FarmView): void {
  try {
    window.localStorage.setItem(FARM_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // A remembered filter is not worth failing a render over.
  }
}
