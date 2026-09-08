/**
 * One parse, two views of the same account: the `HeroRecord[] + AccountShared` pair the farm
 * estimator reads, and the `TeamPlanInput` the Team Plan reads.
 *
 * They MUST come from a single parse and describe the same account field for field, or a test
 * comparing the two paths' gold/hr is comparing two accounts and will report the difference as a
 * bridge defect. The hero ORDER matters too: the rotation's aura total is an expectation over a
 * capped sum, enumerated carrier by carrier, so a reordered roster is not bit-identical.
 *
 * The two mutations below exist because the committed corpus cannot exhibit either condition on
 * its own, and both are conditions a bridge defect hides behind:
 *
 *   - `scopeByIndex` — every capture's heroes are all optimize-scoped, so a squad that is not the
 *     search's scope is unreachable without one;
 *   - `stripAbilities` — every capture carries at least one team-aura carrier, so an all-zero
 *     aura vector is unreachable without one.
 */
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { phaseLine } from '@bombfarm/domain/phases';
import { treeTotalsFromSave } from '@bombfarm/domain/save-units';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type {
  ScopeState,
  TeamPlanHeroInput,
  TeamPlanInput,
} from '@bombfarm/domain/team-plan/types';
import { loadFixtureJson } from './sheet-math-fixtures';

export type TeamPlanFarmFixture = {
  heroes: HeroRecord[];
  account: AccountShared;
  /** The squad the estimator must price to answer the same question the plan's farm objective
   *  does — optimize and leave-alone scope, in roster order. */
  enabledHeroIds: string[];
  teamPlanInput: TeamPlanInput;
  inventory: InventoryItem[];
};

export type TeamPlanFarmFixtureOptions = {
  forgeFloor?: number;
  /**
   * Scope overrides by roster POSITION — the captures' hero ids are opaque, so the index is the
   * only handle a test can name. Every hero without an override stays `'optimize'`.
   */
  scopeByIndex?: Readonly<Record<number, ScopeState>>;
  /** Abilities deleted from every hero, before anything downstream reads them. */
  stripAbilities?: readonly string[];
};

function withoutAbilities(
  abilities: Record<string, number>,
  strip: readonly string[],
): Record<string, number> {
  const out = { ...abilities };
  for (const id of strip) delete out[id];
  return out;
}

export function loadTeamPlanFarmFixture(
  file: string,
  options: TeamPlanFarmFixtureOptions = {},
): TeamPlanFarmFixture {
  const { forgeFloor = 0, scopeByIndex = {}, stripAbilities = [] } = options;
  const raw = loadFixtureJson(file);
  const parsed = parseAccountPayload(raw, []);
  if (parsed.rejected) throw new Error(`fixture "${file}" was rejected: ${parsed.rejected.reason}`);

  const data = parsed.account;
  const tree = data.tree;
  if (!tree) throw new Error(`fixture "${file}" carries no skill tree`);
  const phase = data.phase ?? 1;
  const mitigationPct = (phaseLine(phase)?.mitig ?? 0) * 100;

  const unblocked = parsed.candidates.filter((candidate) => !candidate.blocked);
  const heroes: HeroRecord[] = unblocked.map((candidate, index) => ({
    ...candidate.record,
    abilities: withoutAbilities(candidate.record.abilities, stripAbilities),
    id: candidate.sourceId,
    updatedAt: index,
  }));

  const account: AccountShared = {
    tree: {
      danoTotal: tree.danoTotal,
      critChance: tree.critChance,
      critDmg: tree.critDmg,
      speed: tree.speed,
      energy: tree.energy,
      teamCoinPct: tree.teamCoinPct ?? 0,
      luckFlatPct: tree.luckFlatPct,
      xpMult: tree.xpMult,
    },
    teamBuffs: computeTeamBuffsFromDeployed(heroes),
    context: {
      houseIdx: data.houseIdx ?? 0,
      houseLevel: data.houseLevel ?? 1,
      phase,
      mitigationPct,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
    slots: data.slots ?? undefined,
    fieldSlots: data.fieldSlots ?? null,
    houseCycleSecs: data.houseCycleSecs ?? null,
    maxPhase: data.maxPhase ?? null,
  };

  const planHeroes: TeamPlanHeroInput[] = unblocked.map((candidate, index) => ({
    heroId: candidate.sourceId,
    name: candidate.name,
    level: candidate.level,
    stars: candidate.record.stars,
    rarity: candidate.rarity,
    birth: candidate.record.birth,
    abilities: heroes[index].abilities,
    pts: candidate.record.pts,
    loadout: candidate.record.loadout,
    battleAllowed: candidate.record.battleAllowed,
  }));
  const scopes: ScopeState[] = planHeroes.map((_, index) => scopeByIndex[index] ?? 'optimize');
  const scopeByHeroId = Object.fromEntries(
    planHeroes.map((hero, index) => [hero.heroId, scopes[index]]),
  );

  const teamPlanInput: TeamPlanInput = {
    heroes: planHeroes,
    inventory: parsed.inventory,
    account: {
      treeSheet: treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals),
      houseIdx: data.houseIdx ?? 0,
      houseLevel: data.houseLevel ?? 1,
      phase,
      mitigationPct,
      slots: data.slots ?? DEFAULT_CASA_SLOTS,
      fieldSlots: data.fieldSlots ?? data.slots ?? DEFAULT_CASA_SLOTS,
      cycleSecs: data.houseCycleSecs ?? null,
      teamCoinPct: tree.teamCoinPct ?? 0,
      xpMult: tree.xpMult,
      maxPhase: data.maxPhase ?? null,
    },
    scopeByHeroId,
    forgeFloor,
  };

  return {
    heroes,
    account,
    enabledHeroIds: planHeroes
      .filter((_, index) => scopes[index] !== 'donate')
      .map((hero) => hero.heroId),
    teamPlanInput,
    inventory: parsed.inventory,
  };
}
