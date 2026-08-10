/**
 * The `AccountShared` concern of `@/shared/lib/storage` — `TreeState`/`HeroContext`/
 * `AccountShared` themselves, their defaults, and their load-time normalizers — split out to
 * keep `storage.ts` under the shared-lib `max-lines` cap. `storage.ts` sat at its file-specific
 * allowlist cap with zero slack after four straight waves of "bump the cap, not this wave's
 * scope to split"; this wave finally splits it instead of bumping a fifth time. Extracting
 * `TreeState`/`DEFAULT_TREE`/`normalizeTree` alone (its immediate persisted-field growth) was
 * not enough slack on its own to clear the default 300-line cap without a bump, so its two
 * siblings under the same `AccountShared` envelope — `HeroContext` and `AccountShared` itself,
 * with their own defaults/normalizers — moved out alongside it as one cohesive "account-shared
 * state" concern, distinct from the `HeroRecord` persistence concern `storage.ts` keeps.
 *
 * `loadAccountShared`/`saveAccountShared` (the actual localStorage I/O) stay in `storage.ts` —
 * they need `HeroRecord` for the legacy per-hero-donor migration path, so moving them here would
 * just trade one cross-module dependency for its reverse. `storage.ts` re-exports every symbol
 * below so existing import paths and persistence bytes stay exactly as they were.
 */
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import type { RankMode } from '@bombfarm/domain/model';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';

export type TreeState = {
  /** Squad damage × from the tree UI — already includes GEO / compound / keystone damage mults. */
  danoTotal: number;
  critChance: number;
  /** Crit damage bonus as % of base roll (g_crit_dmg). */
  critDmg: number;
  speed: number;
  energy: number;
  /** Account-wide team_coin total as % (Ouro por Alvo nodes) — scales gold per prop. */
  teamCoinPct: number;
  /** C15 Glass Cannon: crit dmg ×2 (unless Abisso), energy ×0.5. */
  glassCannon: boolean;
  /** V15 Tempo Dobrado: field pace ×1.333, drain ×2. */
  tempoDobrado: boolean;
  /**
   * D15 Abisso — cancels tree Crit/GEO sheet adds and Glass Cannon crit ×2; energy ×0.5 still
   * applies. Additive on `bf-hp-account-v1` (default false).
   */
  abisso?: boolean;
  /** `skills.totals.abisso_base` — damage × abissoBase^currentPhase; 0 when unowned (combat-layer only, see `computeCombatMults`). */
  abissoBase?: number;
  /** `skills.totals.crit_dmg_mult` — Glass Cannon's crit-dmg mult on the birth base; sheet-layer only, 1 when unowned. */
  critDmgMult?: number;
  /**
   * Flat Luck percentage points from `skills.totals.luck_add × 100` (AD-BSP-22, ASM-01).
   * Additive on `bf-hp-account-v1` — optional (not `number`) so pre-Wave-5 literals (e.g.
   * `e2e/fixtures/seed.ts`, out of this wave's touch scope) keep typechecking; every read
   * site defaults absence to `0` and `normalizeTree`'s spread fills it on load. Import-sourced
   * only; no Account UI field yet (CARRY-05).
   */
  luckFlatPct?: number;
};

export type HeroContext = {
  houseIdx: number;
  houseLevel: number;
  /** Synced from Phases via “Use as farm phase”; null until set. DPS uses phase 1 when null. */
  phase: number | null;
  mitigationPct: number;
  rankMode: RankMode;
  /** Oneshot / HTK prop — null until set on Account. */
  targetProp: string | null;
  /** @deprecated always serial — ignored on load. */
  cycleModel?: 'serial' | 'wiki';
  /** @deprecated use {@link FARM_WALK_DELAY_SEC} — ignored on load. */
  walkDelay?: number;
  /** @deprecated dropped — ignored on load. */
  extraDmgPct?: number;
};

/** Shared across every hero on this browser (tree, team buffs, farming context). */
export type AccountShared = {
  tree: TreeState;
  teamBuffs: Record<string, number>;
  context: HeroContext;
  /** Casa field slots — defaults to {@link DEFAULT_CASA_SLOTS} when absent on load. */
  slots?: number;
  /** Optimizer forge floor — defaults to `10` when absent; import never overwrites. */
  forgeFloor?: number;
};

export const DEFAULT_TREE = (): TreeState => ({
  danoTotal: 1,
  critChance: 0,
  critDmg: 0,
  speed: 0,
  energy: 0,
  teamCoinPct: 0,
  glassCannon: false,
  tempoDobrado: false,
  abisso: false,
  abissoBase: 0,
  critDmgMult: 1,
  luckFlatPct: 0,
});

export const DEFAULT_CONTEXT = (): HeroContext => ({
  houseIdx: 0,
  houseLevel: 0,
  phase: null,
  mitigationPct: 1,
  rankMode: 'dps',
  targetProp: DEFAULT_TARGET_PROP,
});

export const DEFAULT_ACCOUNT = (): AccountShared => ({
  tree: DEFAULT_TREE(),
  teamBuffs: {},
  context: DEFAULT_CONTEXT(),
});

function normalizeTree(raw?: (Partial<TreeState> & { geo?: number }) | null): TreeState {
  const base = DEFAULT_TREE();
  if (!raw) return base;
  const { geo: _geo, ...rest } = raw;
  return { ...base, ...rest };
}

function normalizeContext(raw?: Partial<HeroContext> | null): HeroContext {
  const base = DEFAULT_CONTEXT();
  if (!raw) return base;
  const phase =
    raw.phase == null || raw.phase <= 0
      ? null
      : Math.max(1, Math.min(600, Math.round(raw.phase)));
  const targetProp =
    raw.targetProp == null || raw.targetProp === ''
      ? base.targetProp
      : raw.targetProp;
  return {
    houseIdx: raw.houseIdx ?? base.houseIdx,
    houseLevel: raw.houseLevel ?? base.houseLevel,
    phase,
    mitigationPct: raw.mitigationPct ?? base.mitigationPct,
    rankMode: raw.rankMode ?? base.rankMode,
    targetProp,
  };
}

function normalizeForgeFloor(raw?: number): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 10;
  return Math.max(0, Math.min(FORJA_MAX, Math.round(value)));
}

function normalizeSlots(raw?: number): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_CASA_SLOTS;
  return Math.max(1, Math.round(value));
}

export function normalizeAccount(raw?: Partial<AccountShared> | null): AccountShared {
  return {
    tree: normalizeTree(raw?.tree),
    teamBuffs: raw?.teamBuffs ?? {},
    context: normalizeContext(raw?.context),
    slots: normalizeSlots(raw?.slots),
    forgeFloor: normalizeForgeFloor(raw?.forgeFloor),
  };
}
