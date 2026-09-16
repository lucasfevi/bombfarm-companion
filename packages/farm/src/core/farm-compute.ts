// The ONLY file in @bombfarm/farm that imports a runtime binding from @bombfarm/domain/farm-rate
// or @bombfarm/domain/farm-optimize, and apps/web and apps/desktop must import neither (enforced
// by a structural guard — see farm-ranking-guards.test.ts, guards (f) and (g); a type-only
// `ReturnBonusMode`/`FarmRateRow` import erases at compile time and is allowed anywhere).
//
// computeFarmRates is @bombfarm/domain's own stated convenience entry point — it fixes the
// facts -> squad -> rows ordering in one place. Do NOT hand-compose computeHeroFarmFacts +
// computeSquadFarmFacts + computeFarmRateTable here: that re-creates the domain package's
// ordering contract in a second place for no benefit. returnBonusMultiplier and E_D_CELLS are
// intentionally never imported — this surface never applies a multiplier or a cadence constant
// itself.
import {
  computeFarmRates,
  farmTeamBuffs,
  type FarmAccount,
  type FarmRateRow,
} from '@bombfarm/domain/farm-rate';
// resolveFarmObjective, farmObjectiveValue and bestFarmPhase are deliberately NOT imported —
// that surface belongs to the next-point ranking mode, not to this board.
import { FARM_RESPEC_MIN_GAIN_PCT } from '@bombfarm/domain/farm-optimize';
import type { AccountShared } from '@bombfarm/domain/shims/storage';
import type { FarmInputs } from './farm-inputs';

export type FarmRankingReason = 'no-roster' | 'no-heroes-enabled' | 'compute-failed';

export type FarmRankingResult = {
  rows: readonly FarmRateRow[];
  /** `null` on a real compute; a named reason when rows is deliberately empty. */
  reason: FarmRankingReason | null;
};

const EMPTY_ROWS: readonly FarmRateRow[] = [];

/**
 * The dependency-tuple traceability artifact: every planner edit the board must react to.
 * 19 members — `fieldSlots` and `houseCycleSecs` joined at the House-ceiling fix: the first is
 * the FIELD concurrency cap (`skills.field_slots`, a different quantity from `slots`, which is
 * the House's RECOVERY cap), the second is the House cycle that every hero's uptime divides by.
 * `houseCycleSecsHouseIdx`/`houseCycleSecsLevel` joined at the same fix's regression repair: the
 * (house, level) `houseCycleSecs` is anchored to, snapshotted separately from the live
 * `houseIdx`/`houseLevel` picker above so `resolveHouseRestSeconds` can tell a picker move from
 * the account's own imported configuration — omitting either from this tuple would leave the
 * board computing against a stale anchor after a re-import. `maxPhase` is here because
 * `FarmRateOptions.maxPhase` is what sets `FarmRateRow.locked` (a COMPUTE INPUT, not a
 * post-compute filter; an earlier design draft treating it as a filter would have made
 * `row.locked` permanently `false`). `aurasAtCap` is the player's assumption about the auras and
 * a member for the same reason `farmReturnBonus` is. A field missing from this tuple is a
 * planner edit that silently does not recompute the board. The auras' rotation-weighted totals
 * are not a member and need none: the board derives them from `heroes` itself.
 *
 * The converse obligation falls on PRODUCERS in the HOST APP: the members compared by reference
 * here (`heroes`, `farmPoolOverrides`, `aurasAtCap`) must be identity-stable across a
 * write that changed nothing. {@link farmDepsEqual} compares with `Object.is`, so a
 * fresh-but-equal array or object reads exactly like a real edit — it recomputes the whole
 * 600-row board with no error surfaced. Every roster producer must return the SAME array when
 * nothing changed, and the single writer of the roster must decline to write an unchanged
 * reference; a new roster producer owes both halves.
 */
export function readFarmDepTuple(inputs: FarmInputs) {
  return [
    inputs.heroes,
    inputs.treeDanoTotal,
    inputs.treeCritChance,
    inputs.treeCritDmg,
    inputs.treeSpeed,
    inputs.treeEnergy,
    inputs.treeTeamCoinPct,
    inputs.treeLuckFlatPct,
    inputs.houseIdx,
    inputs.houseLevel,
    inputs.slots,
    inputs.fieldSlots,
    inputs.houseCycleSecs,
    inputs.houseCycleSecsHouseIdx,
    inputs.houseCycleSecsLevel,
    inputs.maxPhase,
    inputs.farmPoolOverrides,
    inputs.farmReturnBonus,
    inputs.aurasAtCap,
  ] as const;
}

export function farmDepsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

/** `overrides[id] ?? (hero.battleAllowed ?? true)` — absence follows the save. */
export function resolveEnabledHeroIds(inputs: FarmInputs): string[] {
  const overrides = inputs.farmPoolOverrides;
  return inputs.heroes
    .filter((hero) => overrides[hero.id] ?? (hero.battleAllowed ?? true))
    .map((hero) => hero.id);
}

/**
 * Minimal `FarmAccount` built directly from the tuple's own primitive fields — not a host's
 * full account snapshot (whose own tuple carries fields, e.g. `mitigationPct`/`phase`/
 * `rankMode`/`targetProp`, that `pipelineForHero(hero, account, 1, 0)` never reads because the
 * farm-rate module calls it with an explicit phase/mitigation of its own). Keeping this seam's
 * own tuple as the single source of "what triggers a recompute" avoids a second referential-
 * stability mechanism.
 */
export function buildAccount(inputs: FarmInputs): FarmAccount {
  return {
    tree: {
      danoTotal: inputs.treeDanoTotal,
      critChance: inputs.treeCritChance,
      critDmg: inputs.treeCritDmg,
      speed: inputs.treeSpeed,
      energy: inputs.treeEnergy,
      teamCoinPct: inputs.treeTeamCoinPct,
      luckFlatPct: inputs.treeLuckFlatPct,
    },
    context: {
      houseIdx: inputs.houseIdx,
      houseLevel: inputs.houseLevel,
      phase: null,
      mitigationPct: 1,
      rankMode: 'dps',
      targetProp: 'stone',
    },
    // Spread rather than assigned: `FarmAccount.slots` is optional-and-absent, never explicitly
    // undefined, so a host with no House slots figure must omit the key rather than set it.
    ...(inputs.slots === undefined ? {} : { slots: inputs.slots }),
    fieldSlots: inputs.fieldSlots,
    houseCycleSecs: inputs.houseCycleSecs,
    houseCycleSecsHouseIdx: inputs.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: inputs.houseCycleSecsLevel,
    maxPhase: inputs.maxPhase,
    aurasAtCap: inputs.aurasAtCap,
  };
}

/**
 * The team-aura totals the board prices its rows against — each carrier weighted by its own
 * uptime, over the same pool {@link computeFarmRanking} resolves. The figure a roster-wide
 * surface beside the board (the phases explorer's squad ranking) prices against, so it and the
 * board agree. Costs one pipeline pass per pooled hero; a host memoizes it on the dep tuple.
 */
export function computeFarmTeamBuffs(inputs: FarmInputs): Record<string, number> {
  return farmTeamBuffs({
    heroes: inputs.heroes,
    account: buildAccount(inputs),
    enabledHeroIds: resolveEnabledHeroIds(inputs),
  });
}

/** {@link buildAccount} with {@link computeFarmTeamBuffs} overlaid — the account a ROSTER-WIDE
 *  figure beside the board computes against. */
export function buildRosterAccount(inputs: FarmInputs): AccountShared {
  return { ...buildAccount(inputs), teamBuffs: computeFarmTeamBuffs(inputs) };
}

export function computeFarmRanking(inputs: FarmInputs): FarmRankingResult {
  // The empty pool is short-circuited BEFORE the call, never delegated. @bombfarm/domain's
  // documented behaviour for enabledHeroIds: [] is 600 rows of 0 / Infinity / infeasible:true —
  // correct as a total function, and exactly the table of zeros the surface must never render.
  if (inputs.heroes.length === 0) {
    return { rows: EMPTY_ROWS, reason: 'no-roster' };
  }
  const enabledHeroIds = resolveEnabledHeroIds(inputs);
  if (enabledHeroIds.length === 0) {
    return { rows: EMPTY_ROWS, reason: 'no-heroes-enabled' };
  }

  try {
    const { rows } = computeFarmRates({
      heroes: inputs.heroes,
      account: buildAccount(inputs),
      enabledHeroIds,
      returnBonus: inputs.farmReturnBonus,
      maxPhase: inputs.maxPhase,
    });
    return { rows, reason: null };
  } catch {
    // Caught at THIS boundary only — never downstream. A throw becomes a named, renderable
    // reason instead of being swallowed into an empty list that reads as "no good phases".
    return { rows: EMPTY_ROWS, reason: 'compute-failed' };
  }
}

/**
 * The gain a plan must clear before a surface calls it worth making — the floor the domain's
 * points solver applies, re-exported so a host names it without a second runtime import of that
 * solver (guard (g)).
 */
export const FARM_RESPEC_WORTH_MAKING_PCT = FARM_RESPEC_MIN_GAIN_PCT;

export type FarmPoolEntry = {
  heroId: string;
  heroName: string;
  /** `overrides[id] ?? (battleAllowed ?? true)` — the same resolution `computeFarmRates` uses. */
  enabled: boolean;
};

/**
 * Pure derivation, one entry per roster hero in roster order — the rotation-pool chip row's
 * data source. NOT a store selector: it allocates a new array every call, so a component must
 * wrap it in its own `useMemo` keyed on the roster and the overrides (both already-stable store
 * references) rather than subscribing to it directly — a selector that returns a fresh array on
 * every invocation makes `useSyncExternalStore` re-render forever.
 */
export function deriveFarmPoolEntries(
  heroes: FarmInputs['heroes'],
  farmPoolOverrides: FarmInputs['farmPoolOverrides'],
): FarmPoolEntry[] {
  return heroes.map((hero) => ({
    heroId: hero.id,
    heroName: hero.name,
    enabled: farmPoolOverrides[hero.id] ?? (hero.battleAllowed ?? true),
  }));
}
