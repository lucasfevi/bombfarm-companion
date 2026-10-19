/**
 * What the farm screen remembers between visits: the rotation-pool overrides, the return-bonus
 * mode, the auras held at their cap, the map size the player picked and the phase they had
 * selected.
 *
 * Its own key, deliberately not the web planner's. The two apps read different accounts out of
 * different stores, and sharing a key would be a claim that one screen's state is the other's.
 */
import { normalizeStoredReturnBonus, type ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import { isMapSize, type MapSize } from '@bombfarm/domain/model';
import { normalizeAurasAtCap } from '@bombfarm/team-plan/core';
import { DEFAULT_FARM_CONTROLS, type FarmControls } from './farm-inputs';

const FARM_VIEW_STORAGE_KEY = 'bfc-farm-view';

export type FarmView = Omit<FarmControls, 'farmMapSize'> & {
  /** The phase whose detail the player had open. Post-compute — it never invalidates a snapshot. */
  readonly selectedPhase: number | null;
  /** The map size the player picked over the one the game is drawing. `null` follows the game. */
  readonly farmMapSizeOverride: MapSize | null;
};

export const DEFAULT_FARM_VIEW: FarmView = {
  farmPoolOverrides: DEFAULT_FARM_CONTROLS.farmPoolOverrides,
  farmReturnBonus: DEFAULT_FARM_CONTROLS.farmReturnBonus,
  aurasAtCap: DEFAULT_FARM_CONTROLS.aurasAtCap,
  selectedPhase: null,
  farmMapSizeOverride: null,
};

export function effectiveMapSize(override: MapSize | null, live: MapSize | null): MapSize {
  return override ?? live ?? 'classic';
}

export function isMapSizeDetected(override: MapSize | null, live: MapSize | null): boolean {
  return override === null && live !== null;
}

/** Picking the size the game is drawing goes back to following the game, so a later switch in
 *  the game is followed rather than held against it. */
export function mapSizeOverrideFor(pick: MapSize, live: MapSize | null): MapSize | null {
  return pick === live ? null : pick;
}

function normalizeReturnBonus(value: unknown): ReturnBonusMode {
  return normalizeStoredReturnBonus(value).returnBonus;
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

function normalizeMapSizeOverride(value: unknown): MapSize | null {
  return isMapSize(value) ? value : null;
}

function normalizeFarmView(value: unknown): FarmView {
  if (typeof value !== 'object' || value === null) return DEFAULT_FARM_VIEW;
  const raw = value as Record<string, unknown>;
  return {
    farmPoolOverrides: normalizePoolOverrides(raw.farmPoolOverrides),
    farmReturnBonus: normalizeReturnBonus(raw.farmReturnBonus),
    aurasAtCap: normalizeAurasAtCap(raw.aurasAtCap),
    selectedPhase: normalizeSelectedPhase(raw.selectedPhase),
    farmMapSizeOverride: normalizeMapSizeOverride(raw.farmMapSizeOverride),
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

/** For a screen that shares the Farm screen's map size without owning the rest of its view. */
export function saveFarmMapSizeOverride(farmMapSizeOverride: MapSize | null): void {
  saveFarmView({ ...loadFarmView(), farmMapSizeOverride });
}
