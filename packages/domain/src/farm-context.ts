import type { AbilityMods, Context } from './model';
import type { CycleModel } from './model';
import type { HeroContext } from './shims/storage';
import { resolveHouseRestSeconds } from './model/house';
import { wikiPhaseLine } from './phase-wiki';

/** Fixed serial bomb cycle — not user-editable. */
export const FARM_CYCLE_MODEL = 'serial' as const satisfies CycleModel;

/** Default walk delay between explosion and next plant (serial model). */
export const FARM_WALK_DELAY_SEC = 0.15;

/**
 * Ranking / HTK prop default — Stone (Account default). Single source for the four sites
 * that used to hardcode the `'stone'` literal: {@link effectiveTargetProp} here,
 * `DEFAULT_CONTEXT` in `shared/lib/storage.ts`, and the two fallbacks in
 * `account-farm-target-fields.tsx`.
 */
export const DEFAULT_TARGET_PROP = 'stone';

/** Farm phase for DPS math — defaults to 1 until user syncs from Phases. */
export function effectiveFarmPhase(phase: number | null | undefined): number {
  if (phase == null || phase <= 0) return 1;
  return Math.max(1, Math.min(600, Math.round(phase)));
}

/** Mitigation % for DPS — phase 1 wiki line when farm phase is unset. */
export function effectiveMitigationPct(context: Pick<HeroContext, 'phase' | 'mitigationPct'>): number {
  if (context.phase != null && context.phase > 0) return context.mitigationPct;
  const line = wikiPhaseLine(1);
  return line ? line.mitig * 100 : context.mitigationPct;
}

/** Ranking / HTK prop — Stone when unset (Account default). */
export function effectiveTargetProp(targetProp: string | null | undefined): string {
  if (targetProp) return targetProp;
  return DEFAULT_TARGET_PROP;
}

/**
 * `targetProp` can no longer be `null`/`''` in normalized state: `DEFAULT_CONTEXT` and
 * `normalizeContext` (storage.ts) both coerce absence to `DEFAULT_TARGET_PROP`, and the
 * Account Select can no longer emit `''` (see account-farm-target-fields.tsx). So this is
 * now only reachable via hand-edited localStorage bypassing normalization — kept as a guard
 * for that case, not for anything reachable through the app's own UI/import path.
 */
export function isTargetPropUnset(targetProp: string | null | undefined): boolean {
  return targetProp == null || targetProp === '';
}

export type FarmContextForHeroInput = {
  mods: AbilityMods;
  teamDrainMult: number;
  houseIdx: number;
  houseLevel: number;
  mitigationPct: number;
  phase?: number | null;
  /**
   * `casa.cycle_secs` from the save — the House's own full-fill countdown, in seconds. Absent
   * (`undefined`/`null`) falls back to the {@link HOUSES} interpolation, which is a ~7.8%-fast
   * reconstruction; see {@link resolveHouseRestSeconds}.
   *
   * DELIBERATELY NOT farm-board-only: this feeds `Context.restSeconds`, which the ADVISOR
   * (`advisor-pipeline.ts`) and the TEAM-PLAN scorer (`team-plan/score.ts`) read for duty cycle
   * and sustained DPS exactly as the farm board does. Rest time is rest time — special-casing the
   * measured cycle to one surface would leave the other two knowingly wrong.
   */
  cycleSecs?: number | null;
};

/** Shared per-hero farm `Context` — AD-RGO-27 drain path for advisor + team-plan scorer. */
export function farmContextForHero(input: FarmContextForHeroInput): Context {
  const mitPct = effectiveMitigationPct({
    phase: input.phase ?? null,
    mitigationPct: input.mitigationPct,
  });
  const rest = resolveHouseRestSeconds(input.cycleSecs, input.houseIdx, input.houseLevel);
  return {
    restSeconds: rest,
    mitigation: mitPct / 100,
    blastRange: 1 + input.mods.rangeCells,
    cycleModel: FARM_CYCLE_MODEL,
    walkDelay: FARM_WALK_DELAY_SEC,
    drainMult: input.mods.drainMult * input.teamDrainMult,
  };
}
