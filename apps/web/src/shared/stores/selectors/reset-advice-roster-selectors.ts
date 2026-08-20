import {
  effectiveFarmPhase,
  effectiveMitigationPct,
} from '@bombfarm/domain/farm-context';
import { listHeroesWithResetAdvice } from '@bombfarm/domain/roster-dps';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import type { PlannerStore } from '@/shared/stores/planner-store';

export type ResetAdviceRosterRow = { heroId: string; heroName: string; level: number };

let cache: { deps: readonly unknown[]; result: ResetAdviceRosterRow[] } | null = null;

export function resetResetAdviceRosterCache(): void {
  cache = null;
}

function depsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

/**
 * Heroes whose Tier-1 gate recommends a points reset (roster-wide banner).
 * Memoized on heroes identity + account shared reference + effective farm inputs.
 *
 * Deliberately excludes the active hero draft (loadout/pts/abilities/naked/gearedOverride
 * edits in progress) from its deps — those live on the planner-store draft slice, not on
 * `state.heroes`, until committed. So the banner trails the Points tab for the hero
 * currently open: it reflects `state.heroes` as of the last commit, not the live draft.
 */
export function selectHeroesWithResetAdvice(state: PlannerStore): ResetAdviceRosterRow[] {
  const account = selectAccountShared(state);
  const phase = effectiveFarmPhase(state.phase);
  const mitigationPct = effectiveMitigationPct({
    phase: state.phase,
    mitigationPct: state.mitigationPct,
  });
  const deps = [state.heroes, account, phase, mitigationPct] as const;
  if (cache && depsEqual(cache.deps, deps)) return cache.result;
  const result = listHeroesWithResetAdvice(state.heroes, account, phase, mitigationPct);
  cache = { deps, result };
  return result;
}
