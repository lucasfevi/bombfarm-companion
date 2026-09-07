import type { InventoryItem, InventorySnapshot } from '@bombfarm/domain/inventory';
import type {
  TeamPlan as DomainTeamPlan,
  TeamPlanObjective,
} from '@bombfarm/domain/team-plan/types';
import { FORJA_MAX } from '@bombfarm/domain/gear';

export type ScopeState = 'optimize' | 'donate' | 'leaveAlone';

/**
 * What this app asks the search to score, which is NOT the domain's own default. `runTeamPlan`
 * keeps `'dps'` when the field is absent, so every other caller stays byte-identical; the web
 * planner supplies gold instead, because a roster tuned for damage can farm measurably worse.
 */
export const DEFAULT_TEAM_PLAN_OBJECTIVE: TeamPlanObjective = 'farm';

export function isTeamPlanObjective(value: unknown): value is TeamPlanObjective {
  return value === 'dps' || value === 'farm';
}

export type TeamPlanRunStatus = 'idle' | 'running' | 'done' | 'blocked' | 'error';

export type TeamPlan = DomainTeamPlan | null;

export function clampForgeFloor(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(0, Math.min(FORJA_MAX, Math.round(value)));
}

export function defaultScopeForHero(battleAllowed: boolean | undefined): ScopeState {
  return battleAllowed === false ? 'donate' : 'optimize';
}

export function resolveHeroScope(
  hero: { id: string; battleAllowed?: boolean },
  scopeByHeroId: Record<string, ScopeState>,
): ScopeState {
  return scopeByHeroId[hero.id] ?? defaultScopeForHero(hero.battleAllowed);
}

export function buildDefaultScopeMap(
  heroes: { id: string; battleAllowed?: boolean }[],
): Record<string, ScopeState> {
  const scopeByHeroId: Record<string, ScopeState> = {};
  for (const hero of heroes) {
    scopeByHeroId[hero.id] = defaultScopeForHero(hero.battleAllowed);
  }
  return scopeByHeroId;
}

/** Full roster map: battleAllowed defaults, then keep any existing per-hero choices. */
export function mergeScopeForRoster(
  heroes: { id: string; battleAllowed?: boolean }[],
  existing: Record<string, ScopeState>,
): Record<string, ScopeState> {
  const next = buildDefaultScopeMap(heroes);
  for (const hero of heroes) {
    const stored = existing[hero.id];
    if (stored) next[hero.id] = stored;
  }
  return next;
}

export function computeTeamPlanInputSignature(input: {
  heroes: { id: string; updatedAt: number; battleAllowed?: boolean }[];
  inventory: InventorySnapshot;
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  slots: number;
  treeDanoTotal: number;
  houseIdx: number;
  /** `casa.cycle_secs` — moves every hero's duty cycle, so a change must re-run the plan. */
  houseCycleSecs: number | null;
  objective: TeamPlanObjective;
  /** Resolved, not the raw slice field — the derived default moves when the Farm tab's phase does,
   *  and a plan scored at the old one is as stale as one scored for the old objective. */
  targetPhase: number | null;
}): string {
  return JSON.stringify({
    heroIds: input.heroes.map((hero) => hero.id).sort(),
    heroUpdatedAt: input.heroes.map((hero) => `${hero.id}:${hero.updatedAt}`).sort(),
    battleAllowed: input.heroes.map((hero) => `${hero.id}:${hero.battleAllowed !== false}`).sort(),
    importedAt: input.inventory.importedAt,
    itemIds: input.inventory.items.map((item) => item.id).sort(),
    scopeByHeroId: input.scopeByHeroId,
    forgeFloor: input.forgeFloor,
    slots: input.slots,
    treeDanoTotal: input.treeDanoTotal,
    houseIdx: input.houseIdx,
    houseCycleSecs: input.houseCycleSecs,
    objective: input.objective,
    targetPhase: input.targetPhase,
  });
}

export type { InventoryItem, InventorySnapshot };
