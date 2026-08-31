// The ONLY file in @bombfarm/farm that imports a runtime binding from @bombfarm/domain/farm-rate
// or @bombfarm/domain/farm-optimize, and apps/web and apps/desktop must import neither (enforced
// by a structural guard — see farm-ranking-guards.test.ts, guards (f) and (g); a type-only
// `ReturnBonusMode`/`FarmRateRow`/`FarmRespecResult` import erases at compile time and is
// allowed anywhere).
//
// computeFarmRates is @bombfarm/domain's own stated convenience entry point — it fixes the
// facts -> squad -> rows ordering in one place. Do NOT hand-compose computeHeroFarmFacts +
// computeSquadFarmFacts + computeFarmRateTable here: that re-creates the domain package's
// ordering contract in a second place for no benefit. returnBonusMultiplier and E_D_CELLS are
// intentionally never imported — this surface never applies a multiplier or a cadence constant
// itself.
import {
  computeFarmRates,
  computeFarmRateTable,
  type FarmRateRow,
  type SquadFarmFacts,
} from '@bombfarm/domain/farm-rate';
// resolveFarmObjective, farmObjectiveValue and bestFarmPhase are deliberately NOT imported —
// that surface belongs to the next-point ranking mode, not to this recommendation seam.
// respecCostGold is not imported either: every cost this surface renders is already a field on a
// FarmRespecResult/FarmRespecHeroEntry.
import {
  gateFarmRespec,
  solveFarmRespec,
  FARM_RESPEC_MIN_GAIN_PCT,
  type FarmRespecResult,
} from '@bombfarm/domain/farm-optimize';
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
 * `row.locked` permanently `false`). A field missing from this tuple is a planner edit that
 * silently does not recompute the board.
 *
 * `teamBuffsOverride` is a named field on {@link FarmInputs} but is deliberately NOT a member:
 * `effectiveTeamBuffs` below already moves whenever the override does, and adding it would
 * change a tuple whose exact 19-member shape and order existing tests assert.
 *
 * The converse obligation falls on PRODUCERS in the HOST APP: the members compared by reference
 * here (`heroes`, `effectiveTeamBuffs`, `farmPoolOverrides`) must be identity-stable across a
 * write that changed nothing. {@link farmDepsEqual} compares with `Object.is`, so a
 * fresh-but-equal array or object reads exactly like a real edit — it drops a live respec
 * proposal with no error surfaced. Every roster producer must return the SAME array when nothing
 * changed, and the single writer of the roster must decline to write an unchanged reference; a
 * new roster producer owes both halves.
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
    // The effective (override-or-derived) roster total, issue #132 — `heroes` above already
    // covers the "derive" half; this also invalidates on an override edit.
    inputs.effectiveTeamBuffs,
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
 * Minimal `AccountShared` built directly from the tuple's own primitive fields — not a host's
 * full account snapshot (whose own tuple carries fields, e.g. `mitigationPct`/`phase`/
 * `rankMode`/`targetProp`, that `pipelineForHero(hero, account, 1, 0)` never reads because the
 * farm-rate module calls it with an explicit phase/mitigation of its own). Keeping this seam's
 * own tuple as the single source of "what triggers a recompute" avoids a second referential-
 * stability mechanism.
 */
export function buildAccount(inputs: FarmInputs): AccountShared {
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
    // Issue #132: the roster-wide total is DERIVED from the roster by default (an override,
    // when set, wins) — never the stale, silently-zero stored field a fresh import used to
    // leave every carrier's own aura at 0% until someone found the auto-fill button.
    teamBuffs: inputs.effectiveTeamBuffs,
    // Which of the two `teamBuffs` came back. @bombfarm/domain re-derives the auras over the
    // rotation pool when the total is DERIVED (a deployed-line-up snapshot is the wrong quantity
    // for a board that cycles a whole pool through the House), and passes it through verbatim when
    // it is an override — a hand-typed "assume this much aura" has no carriers behind it to weight.
    teamBuffsOverride: inputs.teamBuffsOverride,
    context: {
      houseIdx: inputs.houseIdx,
      houseLevel: inputs.houseLevel,
      phase: null,
      mitigationPct: 1,
      rankMode: 'dps',
      targetProp: 'stone',
    },
    slots: inputs.slots,
    fieldSlots: inputs.fieldSlots,
    houseCycleSecs: inputs.houseCycleSecs,
    houseCycleSecsHouseIdx: inputs.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: inputs.houseCycleSecsLevel,
    maxPhase: inputs.maxPhase,
  };
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
 * The rows for an ALREADY-SOLVED proposed squad — the board's re-rank source. The only call
 * that skips the facts/squad stages, because the solver has already produced the squad.
 */
export function computeFarmProposedRows(
  squad: SquadFarmFacts,
  inputs: FarmInputs,
): FarmRankingResult {
  const rows = computeFarmRateTable(squad, {
    maxPhase: inputs.maxPhase,
    returnBonus: inputs.farmReturnBonus,
  });
  return { rows, reason: null };
}

// -------------------------------------------------------------------------------------------
// Farm Respec Advisor — Tier 1 gate and Tier 2 on-demand solve.
// -------------------------------------------------------------------------------------------

/**
 * The gate/solve dependency tuple. With the objective picker gone, the Respec Advisor's
 * recommendation depends on nothing the ranking board doesn't already — this is currently
 * identical to {@link readFarmDepTuple}, kept as its own named entry point so the Tier 1/Tier 2
 * call sites read "the respec deps", not a re-derivation of the ranking ones.
 */
export function readFarmRespecDepTuple(inputs: FarmInputs) {
  return readFarmDepTuple(inputs);
}

function buildFarmRespecInput(inputs: FarmInputs, enabledHeroIds: readonly string[]) {
  return {
    heroes: inputs.heroes,
    account: buildAccount(inputs),
    enabledHeroIds,
    maxPhase: inputs.maxPhase,
    returnBonus: inputs.farmReturnBonus,
  };
}

export type FarmRespecGateReason = 'no-roster' | 'no-heroes-enabled' | 'gate-failed';

export type FarmRespecGate = {
  /** null when `reason` is set. */
  result: FarmRespecResult | null;
  reason: FarmRespecGateReason | null;
  /** `result != null && result.gainPct >= FARM_RESPEC_MIN_GAIN_PCT`. `paybackHours` is NOT read
   *  here, at any value including null — gain is the only gate. */
  shouldSurface: boolean;
};

/** The one expression `shouldSurface` is built from. `paybackHours` is deliberately never read
 *  here, at any value including `null` — gain alone gates the recommendation; payback is
 *  reported, never used to suppress it. Exported so this exact formula, not a re-derivation of
 *  it, is what the visibility test drives. */
export function computeFarmRespecShouldSurface(result: FarmRespecResult): boolean {
  return result.gainPct >= FARM_RESPEC_MIN_GAIN_PCT;
}

export function computeFarmRespecGate(inputs: FarmInputs): FarmRespecGate {
  // The empty-pool short-circuits are repeated BEFORE the domain call, never delegated —
  // mirrors computeFarmRanking above, and saves a pipeline call the gate would otherwise spend
  // reporting the same named-nothing answer.
  if (inputs.heroes.length === 0) {
    return { result: null, reason: 'no-roster', shouldSurface: false };
  }
  const enabledHeroIds = resolveEnabledHeroIds(inputs);
  if (enabledHeroIds.length === 0) {
    return { result: null, reason: 'no-heroes-enabled', shouldSurface: false };
  }
  try {
    const result = gateFarmRespec(buildFarmRespecInput(inputs, enabledHeroIds));
    return { result, reason: null, shouldSurface: computeFarmRespecShouldSurface(result) };
  } catch {
    // Caught at THIS boundary only. The gate never throws by contract; this renders a named
    // degraded state instead of a silent absence.
    return { result: null, reason: 'gate-failed', shouldSurface: false };
  }
}

/**
 * Tier 2 — the on-demand full solve. A PLAIN FUNCTION: not a selector, not memoized, and never
 * called during render. Its one caller must be an explicit user event (the Optimize button).
 * Calling this anywhere on the dependency-driven render path is the exact hazard the split
 * between this file's two tiers exists to prevent.
 */
export function runFarmRespecSolve(inputs: FarmInputs): FarmRespecResult {
  const enabledHeroIds = resolveEnabledHeroIds(inputs);
  return solveFarmRespec(buildFarmRespecInput(inputs, enabledHeroIds));
}

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
