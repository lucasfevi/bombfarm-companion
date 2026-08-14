/**
 * Farm-rate estimation for Phase Farm Ranking (PFR item B — `spec.md` `R-B1`…`R-B19`,
 * `design.md`). Turns a roster + account into gold/hr, chest/hr, key/hr (signed), gem/hr,
 * time-piece/hr, XP/hr, clear time, one-shot and jaula facts for all 600 wiki phases.
 *
 * ESTIMATOR-ONLY BOUNDARY (`AD-PFR-03`): this module ships its own cadence model
 * (`cycle = max(fuse, E_D_CELLS / w)`) and never touches the advisor's serial model —
 * `farm-context.ts`'s `FARM_CYCLE_MODEL` / `FARM_WALK_DELAY_SEC`, or `model/combat.ts`'s
 * `bombsPerSecond` / `sustainedDps` / `activeDps`. Those keep their exact current behaviour;
 * nothing here reads or writes them, and this module is the only one that computes cadence this
 * way.
 *
 * GATE ATTACK MULT OMITTED (`design.md` Out of Scope): gate rows use the same `avgHitBase` as
 * every other row — `Contra o Relógio`'s gate-only attack bonus is deliberately NOT applied,
 * because `AD-PFR-15`'s "zero pipeline calls per phase" guarantee depends on mitigation being the
 * ONLY phase-dependent damage term. Applying `gateAttackMult` here would make gate-ness a second
 * one. Cost: gate `clearSecs` runs conservative (slightly slow) for a roster carrying that
 * ability — a follow-up if ever wanted, not a bug.
 *
 * SORTE-AVERAGE VS FORTUNA-SUM ASYMMETRY — DO NOT "FIX": Sorte (`SquadFarmFacts.sorteFraction`)
 * is a normalized, uptime-weighted AVERAGE of hero-only luck plus the tree's flat share
 * (`AD-PFR-06` — "the average of on-field heroes' luck"). The Fortuna aura
 * (`SquadFarmFacts.fortunaAura`) is an UNNORMALIZED uptime-weighted SUM (`AD-PFR-07` — an aura is
 * a presence effect that stacks across heroes, not an average). These are deliberately different
 * shapes. `OQ-PFR-3` tracks the live confirmation of the Fortuna-sum's cap order (cap-after-sum,
 * the conservative choice shipped here).
 */
import { fuseSeconds, GRID_SPEED_COEF, EFF_IA, ABILITY_LEVEL_MAX, mitigationFactor } from './model';
import { pipelineForHero } from './roster-dps';
import { DEFAULT_CASA_SLOTS } from './casa-slots';
import {
  DROP_RATES,
  KEY_GATE_COST,
  RETURN_BONUS_ADD,
  RETURN_BONUS_ADD_VIP,
  LOOT_ABILITY_VALUES,
  WIKI_PROPS,
  WIKI_PHASE_LINES,
  GATE_SECS_POR_ATO,
  BOSS_HP_MULT_WIKI,
  JAULA,
  propCountForAto,
  xpPerProp,
  goldRarityMult,
  itemLevelsForPhase,
  itemLevelDropLabel,
  jaulaEarlyCap,
  type WikiPhaseLine,
} from './phase-wiki';
import { hitsToKill, propHp } from './phases';
import type { HeroRecord, AccountShared } from './shims/storage';

/**
 * Expected plant-to-plant displacement, in grid cells, for the walk-bound cadence term
 * `cycle = max(fuse, E_D_CELLS / w)` (`AD-PFR-03`).
 *
 * PROVISIONAL. bombfarm-research `docs/COMBAT_THROUGHPUT.md` measures direct plant-to-plant
 * Manhattan displacement at 4.34 cells (median hop 3.0) over 2,144 attributed plants, with a
 * per-hero spread of 4.04–5.05, and explicitly directs consumers to the direct measurement rather
 * than the regression slopes (3.79 / 4.00, which the D–w correlation inflates). The PRD pins 4.5
 * as the shipped value; it sits above every direct route, so this model runs slightly pessimistic
 * on walk-bound rosters.
 *
 * Resolved by `OQ-PFR-1` (fuse-bound capture with only low-CDR heroes fielded). This constant is
 * the single line to change when it lands — nothing else in the model encodes a cell distance.
 */
export const E_D_CELLS = 4.5;

/**
 * Fortuna's aura ceiling — the ability's own at-max value (`AD-PFR-07`), derived from item A's
 * bundle rather than typed a second time: `LOOT_ABILITY_VALUES.fortuna.perLevel × .max`.
 */
export const FORTUNA_AURA_CAP: number =
  LOOT_ABILITY_VALUES.fortuna.perLevel * LOOT_ABILITY_VALUES.fortuna.max;

/** Off / standard / VIP Return Bonus (`AD-PFR-09`). Default `'off'`. */
export type ReturnBonusMode = 'off' | 'on' | 'vip';

/**
 * `1 | 1 + RETURN_BONUS_ADD | 1 + RETURN_BONUS_ADD_VIP`. Total function — an unrecognized mode
 * (should TypeScript be bypassed at a call site) falls back to `1` rather than throwing.
 */
export function returnBonusMultiplier(mode: ReturnBonusMode): number {
  if (mode === 'on') return 1 + RETURN_BONUS_ADD;
  if (mode === 'vip') return 1 + RETURN_BONUS_ADD_VIP;
  return 1;
}

// ---------------------------------------------------------------------------------------------
// Per-hero facts (design.md §3.2, §4.1)
// ---------------------------------------------------------------------------------------------

export type HeroFarmFacts = {
  heroId: string;
  heroName: string;
  /** Crit-averaged hit BEFORE phase mitigation; already includes dmgMult (2nd blast, execute). */
  avgHitBase: number;
  /** Effective sheet penetration, PERCENT, unclamped — `mitigationFactor` applies the clamp. */
  penetrationPct: number;
  /** `fuseSeconds(effective.cdr)`, seconds. */
  fuseSecs: number;
  /** Grid walk speed `w = effective.speed × GRID_SPEED_COEF`, CELLS PER SECOND. */
  walkSpeedCells: number;
  /** `max(fuseSecs, E_D_CELLS / w)`, seconds. `Infinity` when `w <= 0`. */
  cycleSecs: number;
  /** `1 / cycleSecs`, plants per second. `0` when `cycleSecs` is not finite and positive. */
  plantsPerSec: number;
  /** `1 + 0.5 × context.blastRange`, blocks hit per bomb. Note: `blastRange` is already `1 + rangeCells`. */
  blocksPerBomb: number;
  /** House duty cycle as a FRACTION 0..1 (the pipeline reports this as a percent). */
  uptime: number;
  /** Hero-only Sorte in PERCENTAGE POINTS — the tree's flat share peeled out (`AD-PFR-06`). */
  heroLuckPct: number;
  /** `abilities.veia_ouro`, clamped to `[0, ABILITY_LEVEL_MAX]`. */
  veiaOuroLevel: number;
  /** `abilities.fortuna`, clamped to `[0, ABILITY_LEVEL_MAX]`. */
  fortunaLevel: number;
  /** True when this hero contributes no throughput: `avgHitBase <= 0` or `plantsPerSec <= 0`. */
  degenerate: boolean;
};

export type FarmFactsInput = {
  heroes: readonly HeroRecord[];
  account: AccountShared;
  /**
   * The rotation pool (`AD-PFR-05`). `null`/omitted ⇒ every hero with `battleAllowed !== false`.
   * An explicit `[]` means an EMPTY pool, not "use the default". Ids not present in `heroes` are
   * ignored (intersection semantics).
   */
  enabledHeroIds?: readonly string[] | null;
};

function clampAbilityLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(ABILITY_LEVEL_MAX, level));
}

function resolveEnabledHeroes(
  heroes: readonly HeroRecord[],
  enabledHeroIds: readonly string[] | null | undefined,
): readonly HeroRecord[] {
  if (enabledHeroIds == null) return heroes.filter((hero) => hero.battleAllowed !== false);
  const idSet = new Set(enabledHeroIds);
  return heroes.filter((hero) => idSet.has(hero.id));
}

/** One `pipelineForHero` call per enabled hero. Order follows `heroes` (`AD-PFR-15`). */
export function computeHeroFarmFacts(input: FarmFactsInput): HeroFarmFacts[] {
  const { heroes, account, enabledHeroIds } = input;
  const enabledHeroes = resolveEnabledHeroes(heroes, enabledHeroIds);
  const treeLuckFlatPct = account.tree.luckFlatPct ?? 0;

  return enabledHeroes.map((hero) => {
    // AD-032: the sole HeroRecord entry to the pipeline. phase=1 (not null) + mitigationPct=0
    // is deliberate — `effectiveMitigationPct` only honors mitigationPct=0 when phase is a
    // positive number; with `null` it substitutes phase 1's wiki mitigation instead (design.md §0).
    const pipeline = pipelineForHero(hero, account, 1, 0);

    const avgHitBase = pipeline.avgHit;
    const penetrationPct = pipeline.effective.penetration;
    const fuseSecs = fuseSeconds(pipeline.effective.cdr);
    const walkSpeedCells = pipeline.effective.speed * GRID_SPEED_COEF;
    const cycleSecs =
      walkSpeedCells > 0 && Number.isFinite(walkSpeedCells)
        ? Math.max(fuseSecs, E_D_CELLS / walkSpeedCells)
        : Infinity;
    const plantsPerSec = Number.isFinite(cycleSecs) && cycleSecs > 0 ? 1 / cycleSecs : 0;
    const blocksPerBomb = 1 + 0.5 * pipeline.context.blastRange;
    const uptime = pipeline.uptime / 100;
    const heroLuckPct = Math.max(0, pipeline.adjusted.luck - treeLuckFlatPct);
    const veiaOuroLevel = clampAbilityLevel(hero.abilities.veia_ouro ?? 0);
    const fortunaLevel = clampAbilityLevel(hero.abilities.fortuna ?? 0);
    const degenerate = !(avgHitBase > 0) || !(plantsPerSec > 0);

    const facts: HeroFarmFacts = {
      heroId: hero.id,
      heroName: hero.name,
      avgHitBase,
      penetrationPct,
      fuseSecs,
      walkSpeedCells,
      cycleSecs,
      plantsPerSec,
      blocksPerBomb,
      uptime,
      heroLuckPct,
      veiaOuroLevel,
      fortunaLevel,
      degenerate,
    };
    return facts;
  });
}

// ---------------------------------------------------------------------------------------------
// Squad facts (design.md §3.3, §4.2)
// ---------------------------------------------------------------------------------------------

export type SquadFarmFacts = {
  /** Enabled heroes only, in `heroes` order. */
  heroes: readonly HeroFarmFacts[];
  /** `account.slots ?? DEFAULT_CASA_SLOTS`. */
  fieldSlots: number;
  /** `Σ uptime` over enabled heroes (fractions). */
  uptimeSum: number;
  /** `min(1, fieldSlots / uptimeSum)`; `1` when `uptimeSum === 0` (`AD-PFR-05`). */
  concurrencyScale: number;
  /** Sorte as a FRACTION: `(uptime-weighted mean heroLuckPct + treeLuckFlatPct) / 100`. */
  sorteFraction: number;
  /** `min(FORTUNA_AURA_CAP, Σ uptime_h × perLevel × level_h)`, a FRACTION (`AD-PFR-07`). */
  fortunaAura: number;
  /** `1 + max(0, tree.teamCoinPct) / 100`. */
  teamCoinMult: number;
  /** `tree.luckFlatPct ?? 0`, percentage points — echoed for item C's breakdown tooltip. */
  treeLuckFlatPct: number;
};

export function computeSquadFarmFacts(
  heroFacts: readonly HeroFarmFacts[],
  account: AccountShared,
): SquadFarmFacts {
  const fieldSlots = account.slots ?? DEFAULT_CASA_SLOTS;
  const uptimeSum = heroFacts.reduce((sum, hero) => sum + hero.uptime, 0);
  const concurrencyScale = uptimeSum > 0 ? Math.min(1, fieldSlots / uptimeSum) : 1;
  const treeLuckFlatPct = account.tree.luckFlatPct ?? 0;

  const heroLuckWeightedSum = heroFacts.reduce((sum, hero) => sum + hero.uptime * hero.heroLuckPct, 0);
  const sorteFraction = ((uptimeSum > 0 ? heroLuckWeightedSum / uptimeSum : 0) + treeLuckFlatPct) / 100;

  const fortunaWeightedSum = heroFacts.reduce(
    (sum, hero) => sum + hero.uptime * LOOT_ABILITY_VALUES.fortuna.perLevel * hero.fortunaLevel,
    0,
  );
  const fortunaAura = Math.min(FORTUNA_AURA_CAP, fortunaWeightedSum);

  const teamCoinMult = 1 + Math.max(0, account.tree.teamCoinPct ?? 0) / 100;

  return {
    heroes: heroFacts,
    fieldSlots,
    uptimeSum,
    concurrencyScale,
    sorteFraction,
    fortunaAura,
    teamCoinMult,
    treeLuckFlatPct,
  };
}

/** Blocks struck per second while on field: `plantsPerSec × blocksPerBomb × EFF_IA`. */
function hitsPerSec(hero: HeroFarmFacts): number {
  return hero.plantsPerSec * hero.blocksPerBomb * EFF_IA;
}

// ---------------------------------------------------------------------------------------------
// Module-load prop table (design.md §2.2) — phase-independent, computed once, frozen.
// ---------------------------------------------------------------------------------------------

type PropShare = { hpMult: number; share: number; goldMult: number };

const PROP_WEIGHT_TOTAL = WIKI_PROPS.reduce((sum, prop) => sum + prop.weight, 0);

/** `{ hpMult, share, goldMult }` per wiki prop — `share` and `goldMult` are phase-independent. */
const PROP_SHARES: readonly PropShare[] = WIKI_PROPS.map((prop) => ({
  hpMult: prop.hpMult,
  share: prop.weight / PROP_WEIGHT_TOTAL,
  goldMult: goldRarityMult(prop.rarity),
}));

/** Highest `hpMult` across `WIKI_PROPS` — the one-shot threshold multiplier. */
const MAX_PROP_HP_MULT = WIKI_PROPS.reduce((max, prop) => Math.max(max, prop.hpMult), 0);

/** `Σ share × goldRarityMult` — the phase-independent gold factor (`design.md` §2.2: `1.545`). */
const GOLD_SHARE_FACTOR = PROP_SHARES.reduce((sum, prop) => sum + prop.share * prop.goldMult, 0);

// ---------------------------------------------------------------------------------------------
// Rows (design.md §3.4, §4.3–§4.5)
// ---------------------------------------------------------------------------------------------

export type FarmRateOptions = {
  /** Default `'off'` (`AD-PFR-09`). */
  returnBonus?: ReturnBonusMode;
  /** `account.max_phase`. `null`/omitted ⇒ every row `locked: false` (`AD-PFR-02`). */
  maxPhase?: number | null;
};

export type FarmRateRow = {
  phase: number; // 1..600
  ato: number; // 1..5
  gate: boolean;
  locked: boolean; // phase > maxPhase
  mitigationPct: number; // line.mitig × 100 — PERCENT
  goldPerHour: number;
  chestsPerHour: number;
  /** SIGNED: `>= 0` gain on non-gate, `<= 0` cost on gate (`AD-PFR-08`). */
  keysPerHour: number;
  gemsPerHour: number; // 0 on non-gate
  timePiecesPerHour: number; // 0 on non-gate
  xpPerHour: number;
  propsPerHour: number;
  cyclesPerHour: number; // 0 when clearSecs is not finite
  /** Seconds to clear the map (+ gate boss). `Infinity` when the squad cannot clear it. */
  clearSecs: number;
  gateTimerSecs: number | null; // null on non-gate
  /** Every enabled hero one-shots every prop type. `false` for an empty pool. */
  oneShot: boolean;
  /** gate timeout OR unbounded clear OR zero prop rate. */
  infeasible: boolean;
  itemLevels: number[];
  itemLevelLabel: string;
  jaulaEarlyCapPct: number; // PERCENT (AD-PFR-12 — a fact, not a rate); jaulaEarlyCap(phase)
  /** `JAULA.janelaSecs` — non-VIP, constant across phases since item A's reshape (§2.4.1). */
  jaulaWindowSecs: number;
  /** Throughput-weighted squad E[HTK] — diagnostics for item C's tooltip. `Infinity` when zero-rate. */
  expectedHtk: number;
};

/** `-0` collapses to `0` — never leaks a signed zero into a public field (R-B6 edge case). */
function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

function buildRow(line: WikiPhaseLine, squad: SquadFarmFacts, options: FarmRateOptions): FarmRateRow {
  const bonus = returnBonusMultiplier(options.returnBonus ?? 'off');
  const sorteMult = 1 + squad.sorteFraction;

  // Per-hero, per-phase: mitigation is the ONLY phase-dependent damage term (AD-PFR-15).
  let shareDenom = 0;
  let bossRateSum = 0;
  const perHero = squad.heroes.map((hero) => {
    const mitF = mitigationFactor(line.mitig, hero.penetrationPct);
    const avgHit = hero.avgHitBase * mitF;
    const eHtk = PROP_SHARES.reduce(
      (sum, prop) => sum + prop.share * hitsToKill(avgHit, propHp(line.hp, prop.hpMult)),
      0,
    );
    const bossHtk = hitsToKill(avgHit, propHp(line.hp, BOSS_HP_MULT_WIKI));
    const hps = hitsPerSec(hero);
    const term = (hps * hero.uptime) / eHtk;
    const bossTerm = (hps * hero.uptime) / bossHtk;
    shareDenom += term;
    bossRateSum += bossTerm;
    return { avgHit, eHtk, term };
  });

  const propsPerSec = squad.concurrencyScale * shareDenom;
  const bossPerSec = squad.concurrencyScale * bossRateSum;
  const propsPerHour = 3600 * propsPerSec;

  const veiaOuroPerLevel = LOOT_ABILITY_VALUES.veia_ouro.perLevel;
  let goldSelfMixSum = 0;
  let expectedHtkSum = 0;
  for (let i = 0; i < perHero.length; i++) {
    const hero = squad.heroes[i];
    const { eHtk, term } = perHero[i];
    const share = shareDenom > 0 ? term / shareDenom : 0;
    const goldSelf = 1 + veiaOuroPerLevel * hero.veiaOuroLevel;
    goldSelfMixSum += share * goldSelf;
    // Guard `0 × Infinity = NaN`: a degenerate hero (eHtk === Infinity) with a genuinely zero
    // share must contribute exactly 0 here, not NaN. `share === 0` already means "this hero adds
    // nothing to the squad's throughput" regardless of what its own (unreachable) eHtk is.
    if (share > 0) expectedHtkSum += share * eHtk;
  }
  const goldSelfMix = shareDenom > 0 ? goldSelfMixSum : 1;
  const expectedHtk = shareDenom > 0 ? expectedHtkSum : Infinity;

  const propCount = propCountForAto(line.ato);
  const clearSecs = propCount / propsPerSec + (line.gate ? 1 / bossPerSec : 0);
  const cyclesPerHour = Number.isFinite(clearSecs) && clearSecs > 0 ? 3600 / clearSecs : 0;

  const eGold = line.goldComum * GOLD_SHARE_FACTOR;
  const goldMult = squad.teamCoinMult * (1 + squad.fortunaAura) * bonus;
  const goldPerHour = propsPerHour * eGold * goldMult * goldSelfMix;

  const chestsPerHour = propsPerHour * DROP_RATES.chest * sorteMult * bonus;
  const keysPerHour = line.gate
    ? -(cyclesPerHour * KEY_GATE_COST)
    : propsPerHour * DROP_RATES.key * sorteMult * bonus;
  const gemsPerHour = line.gate ? propsPerHour * DROP_RATES.gem * sorteMult * bonus : 0;
  const timePiecesPerHour = line.gate ? propsPerHour * DROP_RATES.time * sorteMult * bonus : 0;
  const xpPerHour = propsPerHour * xpPerProp(line.phase) * bonus;

  const maxPropHp = line.hp * MAX_PROP_HP_MULT;
  const oneShot = perHero.length > 0 && perHero.every((hero) => hero.avgHit >= maxPropHp);
  const gateTimerSecs = line.gate ? (GATE_SECS_POR_ATO[line.ato - 1] ?? null) : null;
  const infeasible =
    (line.gate && gateTimerSecs != null && clearSecs > gateTimerSecs) ||
    !Number.isFinite(clearSecs) ||
    propsPerSec <= 0;
  const locked = options.maxPhase != null && line.phase > options.maxPhase;

  const itemLevels = itemLevelsForPhase(line.phase);

  return {
    phase: line.phase,
    ato: line.ato,
    gate: line.gate,
    locked,
    mitigationPct: line.mitig * 100,
    goldPerHour: normalizeZero(goldPerHour),
    chestsPerHour: normalizeZero(chestsPerHour),
    keysPerHour: normalizeZero(keysPerHour),
    gemsPerHour: normalizeZero(gemsPerHour),
    timePiecesPerHour: normalizeZero(timePiecesPerHour),
    xpPerHour: normalizeZero(xpPerHour),
    propsPerHour: normalizeZero(propsPerHour),
    cyclesPerHour: normalizeZero(cyclesPerHour),
    clearSecs,
    gateTimerSecs,
    oneShot,
    infeasible,
    itemLevels,
    itemLevelLabel: itemLevelDropLabel(itemLevels),
    jaulaEarlyCapPct: jaulaEarlyCap(line.phase) * 100,
    jaulaWindowSecs: JAULA.janelaSecs,
    expectedHtk,
  };
}

/** `null` for any phase outside `[1, WIKI_PHASE_LINES.length]`, non-integer, or `NaN`. Never clamps. */
function isValidPhase(phase: number): boolean {
  return Number.isInteger(phase) && phase >= 1 && phase <= WIKI_PHASE_LINES.length;
}

/** `null` for any phase outside `[1, WIKI_PHASE_LINES.length]` or without a wiki line. */
export function computeFarmRateRow(
  phase: number,
  squad: SquadFarmFacts,
  options: FarmRateOptions = {},
): FarmRateRow | null {
  if (!isValidPhase(phase)) return null;
  const line = WIKI_PHASE_LINES[phase - 1];
  if (!line) return null;
  return buildRow(line, squad, options);
}

/** All 600 wiki phases, ascending. Zero pipeline calls. */
export function computeFarmRateTable(squad: SquadFarmFacts, options: FarmRateOptions = {}): FarmRateRow[] {
  return WIKI_PHASE_LINES.map((line) => buildRow(line, squad, options));
}

/** Convenience for item C: facts + squad + table in one call. `N` pipeline calls, `N = |enabled|`. */
export function computeFarmRates(
  input: FarmFactsInput & FarmRateOptions,
): { heroFacts: HeroFarmFacts[]; squad: SquadFarmFacts; rows: FarmRateRow[] } {
  const heroFacts = computeHeroFarmFacts(input);
  const squad = computeSquadFarmFacts(heroFacts, input.account);
  const rows = computeFarmRateTable(squad, { returnBonus: input.returnBonus, maxPhase: input.maxPhase });
  return { heroFacts, squad, rows };
}
