/**
 * Inputs for the two informational hero panels: the birth-roll report and the per-ability gains.
 *
 * `abilityGainFor` runs roughly one combat-model pass per ability of the hero's pool, so it is
 * memoised here the way `selectAdvisorPipeline` is — one module-level single-entry cache keyed on
 * a dependency tuple, returning a stable identity on a hit so a component can subscribe without
 * `useShallow`.
 */
import { abilityGainFor, type AbilityGain } from '@bombfarm/domain/ability-gain';
import { rollQualityFor, type RollQualityReport } from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@/shared/lib/storage';
import {
  selectAccountShared,
  selectAccountSharedForCombat,
  selectEffectiveTeamBuffs,
} from '@/shared/stores/selectors/account-selectors';
import {
  selectCombatMitigationPct,
  selectCombatPhase,
} from '@/shared/stores/selectors/phases-selectors';
import { selectHeroDraftTuple } from '@/shared/stores/persistence/persist-hero-draft';
import type { PlannerStore } from '@/shared/stores/planner-store';

function depsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

let draftHeroCache: { deps: readonly unknown[]; result: HeroRecord } | null = null;
let rollQualityCache: { hero: HeroRecord; result: RollQualityReport | undefined } | null = null;
let abilityGainsCache: { deps: readonly unknown[]; result: readonly AbilityGain[] } | null = null;
let abilityGainsComputeCount = 0;

export function resetHeroPanelCaches(): void {
  draftHeroCache = null;
  rollQualityCache = null;
  abilityGainsCache = null;
}

export function getHeroAbilityGainsComputeCount(): number {
  return abilityGainsComputeCount;
}

export function resetHeroAbilityGainsComputeCount(): void {
  abilityGainsComputeCount = 0;
  resetHeroPanelCaches();
}

/**
 * The hero the panels describe: the LIVE draft, through the same projection the debounced
 * autosave stages, so the panels track the editor rather than lagging it by the autosave delay.
 * Building it here never writes anything — `buildHeroRecord` is a pure read of the draft fields.
 */
export function selectDraftHeroRecord(state: PlannerStore): HeroRecord {
  const deps = selectHeroDraftTuple(state);
  if (draftHeroCache && depsEqual(draftHeroCache.deps, deps)) return draftHeroCache.result;
  const result: HeroRecord = {
    ...state.buildHeroRecord(state.activeHeroId),
    id: state.activeHeroId ?? '',
    updatedAt: 0,
  };
  draftHeroCache = { deps, result };
  return result;
}

export function selectHeroRollQuality(state: PlannerStore): RollQualityReport | undefined {
  const hero = selectDraftHeroRecord(state);
  if (rollQualityCache && rollQualityCache.hero === hero) return rollQualityCache.result;
  const result = rollQualityFor(hero);
  rollQualityCache = { hero, result };
  return result;
}

const abilityGainAccount = selectAccountSharedForCombat;

function readAbilityGainDepTuple(state: PlannerStore): readonly unknown[] {
  return [
    selectDraftHeroRecord(state),
    selectAccountShared(state),
    selectEffectiveTeamBuffs(state),
    selectCombatPhase(state),
    selectCombatMitigationPct(state),
  ] as const;
}

export function selectHeroAbilityGains(state: PlannerStore): readonly AbilityGain[] {
  const deps = readAbilityGainDepTuple(state);
  if (abilityGainsCache && depsEqual(abilityGainsCache.deps, deps)) return abilityGainsCache.result;
  abilityGainsComputeCount += 1;
  const result = abilityGainFor(
    selectDraftHeroRecord(state),
    abilityGainAccount(state),
    selectCombatPhase(state),
    selectCombatMitigationPct(state),
  );
  abilityGainsCache = { deps, result };
  return result;
}
