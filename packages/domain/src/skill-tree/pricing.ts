import { DEFAULT_CASA_SLOTS } from '../casa-slots';
import {
  computeFarmRateRow,
  computeHeroFarmBases,
  computeSquadFarmFacts,
  heroFactsFromBasis,
  type FarmAccount,
  type HeroFarmBasis,
  type ReturnBonusMode,
} from '../farm-rate';
import { windowedDamage } from '../model/combat';
import { wikiPhaseLine } from '../phase-wiki';
import { phaseLine } from '../phases';
import type { HeroRecord } from '../shims/storage';
import { buildHeroPlanContexts, evaluateRoster, type TeamPlanAccountInput, type TeamPlanHeroInput } from '../team-plan';
import { SKILL_TREE, type SkillEffectKind, type SkillNode, type SkillTreeCatalog } from './catalog';
import { isBuyable, nodeStatus } from './rules';
import type { SkillTotals, SkillTreeState } from './state';
import { EFFECT_TOTAL_BINDINGS, fieldSlotsFromTotals, totalsWithNode, treeSheetFromTotals, treeStateFromTotals } from './totals';

/**
 * Gold per hour runs through hits-to-kill, a ceiling, so one node's worth at the roster exactly
 * as read is a coin toss: the same +0.5% damage is a whole hit per prop when it crosses a
 * breakpoint and nothing when it does not, and the roster drifts by more than that between two
 * reads. The gain is therefore taken as the mean over nearby roster strengths — every hero's
 * attack scaled by `1 + k × step` for `k` in `[-halfWidth/step, +halfWidth/step]`, both sides of
 * the comparison scaled alike. Damage nodes come out stable from ±2% to ±8%; every other axis is
 * smooth and unchanged by the mean.
 */
export type BreakpointSpread = { readonly halfWidth: number; readonly step: number };

export const BREAKPOINT_SPREAD: BreakpointSpread = { halfWidth: 0.05, step: 0.005 };

/** Kinds that move neither gold/hr nor the combat window: they pay in drops, XP or bag space. */
export const SKILL_KINDS_OUTSIDE_OBJECTIVES: readonly SkillEffectKind[] = ['g_luck', 'team_xp', 'bag_tab'];

const SHEET_LEVEL_KEYS = new Set<keyof SkillTotals>([
  'team_dmg_add',
  'geo_mult',
  'crit_chance_add',
  'crit_dmg_add',
  'speed_add',
  'energia_add',
]);

export type SkillTreePricingInput = {
  readonly heroes: readonly HeroRecord[];
  /** The farm account as the board prices it — tree, House, slots, cycle and `maxPhase`. */
  readonly account: FarmAccount;
  readonly enabledHeroIds: readonly string[] | null;
  readonly returnBonus: ReturnBonusMode;
  /** The phase the account is farming; a node is worth what it is worth here. */
  readonly phase: number;
  /** The tree as the roster stands. */
  readonly totals: SkillTotals;
  readonly state: SkillTreeState;
  readonly catalog?: SkillTreeCatalog;
  /** Node ids to price; every buyable node when absent. */
  readonly candidates?: readonly string[];
  readonly spread?: BreakpointSpread;
  /** Combat window T in seconds. Absent or not positive: no combat figures. */
  readonly combatWindowSecs?: number | null;
  /** Combat roster. Omitted → `enabledHeroIds`. An explicit empty list is empty. */
  readonly combatHeroIds?: readonly string[] | null;
  /** Phase combat is priced at. Omitted → `phase`. */
  readonly combatPhase?: number;
};

export type SkillObjectiveFigures = {
  readonly goldPerHour: number;
  /** `null` when no enabled hero carries birth stats. */
  readonly teamDps: number | null;
};

export type SkillNodeGain = {
  readonly id: string;
  /** The level the gain is priced from — the next level is `level + 1`. */
  readonly level: number;
  readonly cost: number;
  /** Expected over the breakpoint spread. */
  readonly goldPerHourDelta: number;
  /** At the roster exactly as read. */
  readonly goldPerHourDeltaAtRoster: number;
  readonly teamDpsDelta: number | null;
  /** Δ gold/hr per million gold spent — `Infinity` for a free level. */
  readonly goldPerMillion: number;
  readonly dpsPerMillion: number | null;
  /** Effect kinds on the node that neither objective can see. */
  readonly unpriced: readonly SkillEffectKind[];
};

export type SkillTreePricing = {
  readonly phase: number;
  readonly combatPhase: number | null;
  readonly combatWindowSecs: number | null;
  readonly baseline: SkillObjectiveFigures;
  readonly gains: readonly SkillNodeGain[];
  /** Heroes the combat figure had to leave out — no birth stats on record. */
  readonly dpsLeftOut: readonly string[];
};

function accountForTotals(base: FarmAccount, totals: SkillTotals, fieldSlots: number): FarmAccount {
  return { ...base, tree: treeStateFromTotals(totals), fieldSlots };
}

function scaleAttack(basis: HeroFarmBasis, factor: number): HeroFarmBasis {
  if (factor === 1) return basis;
  return { ...basis, effective: { ...basis.effective, attack: basis.effective.attack * factor } };
}

function spreadFactors(spread: BreakpointSpread): number[] {
  const steps = Math.max(0, Math.round(spread.halfWidth / spread.step));
  const factors: number[] = [];
  for (let k = -steps; k <= steps; k++) factors.push(1 + k * spread.step);
  return factors;
}

type GoldModel = {
  readonly bases: readonly HeroFarmBasis[];
  readonly account: FarmAccount;
};

function goldPerHourOf(model: GoldModel, phase: number, factor: number, returnBonus: ReturnBonusMode): number {
  const facts = model.bases.map((basis) => heroFactsFromBasis(scaleAttack(basis, factor), basis.pts));
  const squad = computeSquadFarmFacts(facts, model.account);
  const row = computeFarmRateRow(phase, squad, { returnBonus, maxPhase: model.account.maxPhase ?? null });
  return row && Number.isFinite(row.goldPerHour) ? row.goldPerHour : 0;
}

function goldModelFor(input: SkillTreePricingInput, account: FarmAccount): GoldModel {
  return {
    bases: computeHeroFarmBases({ heroes: input.heroes, account, enabledHeroIds: input.enabledHeroIds }),
    account,
  };
}

function teamPlanHero(hero: HeroRecord): TeamPlanHeroInput {
  return {
    heroId: hero.id,
    name: hero.name,
    level: hero.level,
    stars: hero.stars,
    rarity: hero.rarity,
    ...(hero.birth !== undefined ? { birth: hero.birth } : {}),
    abilities: hero.abilities,
    pts: hero.pts,
    loadout: hero.loadout,
    ...(hero.battleAllowed !== undefined ? { battleAllowed: hero.battleAllowed } : {}),
    runes: hero.runes,
  };
}

function farmHeroes(input: SkillTreePricingInput): readonly HeroRecord[] {
  const ids = input.enabledHeroIds;
  if (ids == null) return input.heroes.filter((hero) => hero.battleAllowed !== false);
  const idSet = new Set(ids);
  return input.heroes.filter((hero) => idSet.has(hero.id));
}

function combatHeroes(input: SkillTreePricingInput): readonly HeroRecord[] {
  if (input.combatHeroIds === undefined) return farmHeroes(input);
  const ids = input.combatHeroIds ?? [];
  const byId = new Map(input.heroes.map((hero) => [hero.id, hero]));
  const selected: HeroRecord[] = [];
  for (const id of ids) {
    const hero = byId.get(id);
    if (hero) selected.push(hero);
  }
  return selected;
}

type DpsModel = {
  readonly heroes: readonly TeamPlanHeroInput[];
  readonly loadoutsByHeroId: Record<string, HeroRecord['loadout']>;
  readonly ptsByHeroId: Record<string, HeroRecord['pts']>;
  readonly leftOut: readonly string[];
  readonly mitigationPct: number;
  readonly phase: number;
  readonly windowSecs: number;
};

function combatWindowSecsOf(input: SkillTreePricingInput): number | null {
  const secs = input.combatWindowSecs;
  return secs != null && secs > 0 ? secs : null;
}

function dpsModelFor(input: SkillTreePricingInput): DpsModel | null {
  const windowSecs = combatWindowSecsOf(input);
  if (windowSecs === null) return null;
  const selected = combatHeroes(input);
  const withBirth = selected.filter((hero) => hero.birth !== undefined);
  const leftOut = selected.filter((hero) => hero.birth === undefined).map((hero) => hero.name);
  const phase = input.combatPhase ?? input.phase;
  const line = wikiPhaseLine(phase) ?? phaseLine(phase);
  return {
    heroes: withBirth.map(teamPlanHero),
    loadoutsByHeroId: Object.fromEntries(withBirth.map((hero) => [hero.id, hero.loadout])),
    ptsByHeroId: Object.fromEntries(withBirth.map((hero) => [hero.id, hero.pts])),
    leftOut,
    mitigationPct: +((line?.mitig ?? 0.01) * 100).toFixed(2),
    phase,
    windowSecs,
  };
}

function windowedTeamDpsOf(model: DpsModel, input: SkillTreePricingInput, totals: SkillTotals, fieldSlots: number): number | null {
  if (model.heroes.length === 0) return null;
  const base = input.account;
  const account: TeamPlanAccountInput = {
    treeSheet: treeSheetFromTotals(totals),
    houseIdx: base.context.houseIdx,
    houseLevel: base.context.houseLevel,
    phase: model.phase,
    mitigationPct: model.mitigationPct,
    slots: base.slots ?? DEFAULT_CASA_SLOTS,
    fieldSlots,
    cycleSecs: base.houseCycleSecs,
    cycleSecsHouseIdx: base.houseCycleSecsHouseIdx,
    cycleSecsLevel: base.houseCycleSecsLevel,
  };
  const scope = Object.fromEntries(model.heroes.map((hero) => [hero.heroId, 'optimize' as const]));
  const built = buildHeroPlanContexts([...model.heroes], account, scope);
  if (built.blocked) return null;
  const evaluation = evaluateRoster({
    contexts: built.contexts,
    loadoutsByHeroId: model.loadoutsByHeroId,
    ptsByHeroId: model.ptsByHeroId,
    slots: fieldSlots,
    farm: {
      houseIdx: account.houseIdx,
      houseLevel: account.houseLevel,
      phase: model.phase,
      mitigationPct: model.mitigationPct,
      cycleSecs: account.cycleSecs,
      cycleSecsHouseIdx: account.cycleSecsHouseIdx,
      cycleSecsLevel: account.cycleSecsLevel,
    },
    forgeFloor: 0,
    aurasAtCap: base.aurasAtCap,
  });
  let damage = 0;
  for (const score of Object.values(evaluation.perHero)) {
    damage += windowedDamage(score.active, score.fieldSeconds, score.context.restSeconds, model.windowSecs);
  }
  const rate = damage / model.windowSecs;
  return Number.isFinite(rate) ? rate : 0;
}

function touchesSheet(node: SkillNode): boolean {
  return node.effects.some((effect) => SHEET_LEVEL_KEYS.has(EFFECT_TOTAL_BINDINGS[effect.kind].key));
}

function fieldSlotDelta(node: SkillNode): number {
  return node.effects.filter((effect) => effect.kind === 'vagas_campo').reduce((sum, effect) => sum + effect.perLevel, 0);
}

function unpricedKinds(node: SkillNode): SkillEffectKind[] {
  return node.effects.map((effect) => effect.kind).filter((kind) => SKILL_KINDS_OUTSIDE_OBJECTIVES.includes(kind));
}

function perMillion(delta: number, cost: number): number {
  if (cost <= 0) return delta > 0 ? Infinity : 0;
  return delta / (cost / 1e6);
}

function resolvedFieldSlots(input: SkillTreePricingInput, catalog: SkillTreeCatalog): number {
  return input.account.fieldSlots ?? fieldSlotsFromTotals(input.totals, catalog);
}

/**
 * Every candidate node priced by the difference it makes to the two objectives at `phase`: the
 * roster rebuilt under the tree with one more level of the node, against the roster under the
 * tree as it stands. Both sides are the same heroes on the same phase one level apart, so the
 * terms the model holds fixed cancel — this is a ranking, not a prediction of the absolute rate.
 */
export function priceSkillTree(input: SkillTreePricingInput): SkillTreePricing {
  const catalog = input.catalog ?? SKILL_TREE;
  const spread = input.spread ?? BREAKPOINT_SPREAD;
  const factors = spreadFactors(spread);
  const baseFieldSlots = resolvedFieldSlots(input, catalog);
  const baseAccount = accountForTotals(input.account, input.totals, baseFieldSlots);

  const baseGold = goldModelFor(input, baseAccount);
  const goldAt = (model: GoldModel, factor: number) => goldPerHourOf(model, input.phase, factor, input.returnBonus);
  const baseGoldByFactor = new Map(factors.map((factor) => [factor, goldAt(baseGold, factor)]));
  const baselineGold = goldAt(baseGold, 1);

  const dpsModel = dpsModelFor(input);
  const baselineDps = dpsModel === null ? null : windowedTeamDpsOf(dpsModel, input, input.totals, baseFieldSlots);

  const candidateIds =
    input.candidates ??
    catalog.nodes.filter((node) => isBuyable(nodeStatus(node, input.state))).map((node) => node.id);

  const gains: SkillNodeGain[] = [];
  for (const id of candidateIds) {
    const node = catalog.nodes.find((entry) => entry.id === id);
    if (!node) continue;
    const status = nodeStatus(node, input.state);
    if (!isBuyable(status) || status.nextCost === null) continue;

    const totals = totalsWithNode(input.totals, node, 1);
    const slotDelta = fieldSlotDelta(node);
    const account = accountForTotals(input.account, totals, baseFieldSlots + slotDelta);
    const gold = touchesSheet(node) ? goldModelFor(input, account) : { bases: baseGold.bases, account };

    let expected = 0;
    for (const factor of factors) expected += goldAt(gold, factor) - (baseGoldByFactor.get(factor) ?? 0);
    expected /= factors.length;
    const atRoster = goldAt(gold, 1) - baselineGold;

    const dpsMoves = touchesSheet(node) || slotDelta !== 0;
    const dps =
      baselineDps === null || dpsModel === null
        ? null
        : dpsMoves
          ? windowedTeamDpsOf(dpsModel, input, totals, baseFieldSlots + slotDelta)
          : baselineDps;
    const dpsDelta = dps === null || baselineDps === null ? null : dps - baselineDps;

    gains.push({
      id: node.id,
      level: status.level,
      cost: status.nextCost,
      goldPerHourDelta: expected,
      goldPerHourDeltaAtRoster: atRoster,
      teamDpsDelta: dpsDelta,
      goldPerMillion: perMillion(expected, status.nextCost),
      dpsPerMillion: dpsDelta === null ? null : perMillion(dpsDelta, status.nextCost),
      unpriced: unpricedKinds(node),
    });
  }

  return {
    phase: input.phase,
    combatPhase: dpsModel === null ? null : dpsModel.heroes.length === 0 ? (input.combatPhase ?? null) : dpsModel.phase,
    combatWindowSecs: dpsModel?.windowSecs ?? null,
    baseline: { goldPerHour: baselineGold, teamDps: baselineDps },
    gains,
    dpsLeftOut: dpsModel?.leftOut ?? [],
  };
}

export type SkillPricingObjective = 'goldPerHour' | 'gateClear' | 'pvp';

export function isCombatSkillObjective(objective: SkillPricingObjective): boolean {
  return objective === 'gateClear' || objective === 'pvp';
}

/** Best value first — the gain per million gold, ties to the cheaper node; zero-gain nodes last. */
export function rankSkillGains(gains: readonly SkillNodeGain[], objective: SkillPricingObjective): SkillNodeGain[] {
  const score = (gain: SkillNodeGain) =>
    objective === 'goldPerHour' ? gain.goldPerMillion : (gain.dpsPerMillion ?? Number.NEGATIVE_INFINITY);
  return [...gains].sort((a, b) => {
    const diff = score(b) - score(a);
    if (Number.isNaN(diff) || diff === 0) return a.cost - b.cost;
    return diff;
  });
}
