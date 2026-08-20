// Re-exported from @bombfarm/domain/farm-rate — NOT re-declared here. The domain package's union is
// 'off' | 'on' | 'vip'; persisting its own literals means this normalizer validates against the
// domain type instead of a local copy that could drift. Type-only import — the one allowlisted
// exception to "computeFarmRates' module is imported in exactly one file" (see farm-ranking-guards.test.ts guard (f)).
// Re-exported below so the slice / components reference the type through this file, not a
// second direct import site.
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
// Type-only import — the ReturnBonusMode precedent directly above. A pure `import type` erases
// at compile time and is allowed by the farm-ranking-guards.test.ts runtime-import boundary.
import type { FarmObjectiveKind } from '@bombfarm/domain/farm-optimize';

export type { ReturnBonusMode };

const PHASES_VIEW_KEY = 'bf-hp-phases-view-v1';

/** Bound on a hand-edited `farmPool` map so a read never iterates an attacker-sized object. */
const MAX_POOL_ENTRIES = 200;

const RETURN_BONUS_MODES: readonly ReturnBonusMode[] = ['off', 'on', 'vip'];

const FARM_OBJECTIVE_KINDS: readonly FarmObjectiveKind[] = ['gold', 'chests', 'blend'];

export type PhasesViewState = {
  /**
   * Absent means the user has never explicitly chosen a phase — distinct from a genuinely
   * persisted phase 1. Consumers that need a concrete number (rather than "was this chosen")
   * fall back to 1 themselves; this type must not do that coercion, or "never chosen" becomes
   * unrepresentable.
   */
  phase?: number;
  /**
   * Farm Ranking rotation pool — hero id -> enabled override.
   * Absent id => follow `HeroRecord.battleAllowed`. Never a save write; estimation-local only.
   */
  farmPool?: Record<string, boolean>;
  /** Return-bonus estimate. Absent/unrecognized => `'off'`. */
  farmReturnBonus?: ReturnBonusMode;
  /** Respec-advisor objective preset. Absent/unrecognized => `'gold'`. */
  farmObjective?: FarmObjectiveKind;
};

export function defaultPhasesView(): PhasesViewState {
  return {};
}

/** `undefined` for anything that isn't a finite number — including a genuinely absent key —
 *  so "never chosen" survives the read instead of being coerced to phase 1. */
function normalizePhase(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return Math.max(1, Math.min(600, Math.round(raw)));
}

/**
 * `farmPool` normalize (design §6.1): non-object -> `{}`; non-boolean entries dropped
 * (siblings kept); empty-string keys dropped; more than `MAX_POOL_ENTRIES` keys -> first
 * `MAX_POOL_ENTRIES` kept. Unknown hero ids are NOT pruned here — a read must not write
 * (the `bf-hp-gear-scope-v1` contract); pruning-on-use happens at the call site.
 */
function normalizeFarmPool(raw: unknown): Record<string, boolean> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_POOL_ENTRIES) break;
    if (key === '') continue;
    if (typeof value !== 'boolean') continue;
    out[key] = value;
    count++;
  }
  return out;
}

function normalizeReturnBonus(raw: unknown): ReturnBonusMode {
  return RETURN_BONUS_MODES.includes(raw as ReturnBonusMode) ? (raw as ReturnBonusMode) : 'off';
}

function normalizeFarmObjective(raw: unknown): FarmObjectiveKind {
  return FARM_OBJECTIVE_KINDS.includes(raw as FarmObjectiveKind) ? (raw as FarmObjectiveKind) : 'gold';
}

export function loadPhasesView(): PhasesViewState {
  try {
    const raw = localStorage.getItem(PHASES_VIEW_KEY);
    if (!raw) return defaultPhasesView();
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultPhasesView();
    }
    const record = parsed as Record<string, unknown>;
    return {
      phase: normalizePhase(record.phase),
      farmPool: normalizeFarmPool(record.farmPool),
      farmReturnBonus: normalizeReturnBonus(record.farmReturnBonus),
      farmObjective: normalizeFarmObjective(record.farmObjective),
    };
  } catch {
    return defaultPhasesView();
  }
}

/**
 * Whole-object write. The **only** composer of a complete `PhasesViewState` is
 * the slice's private `persistPhasesView` — every call site here passes a full state. A partial
 * literal (`{ phase }`) once a second field exists is the exact latent data-loss bug this
 * decision exists to prevent: do NOT turn this into a read-modify-write — merge policy belongs
 * to the slice, which already holds the truth.
 */
export function savePhasesView(state: PhasesViewState): void {
  try {
    localStorage.setItem(PHASES_VIEW_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}
