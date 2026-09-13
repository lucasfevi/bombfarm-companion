/**
 * The rune model against the one capture that carries runes (`payload-20260913-20heroes-runes.json`,
 * see the manifest row): six real runed heroes, one of them runed on every axis. The claim is
 * the sharpest the corpus can make — every hero inverts to whole-number points landing exactly
 * on `level`, and composing those points back with the runes reproduces the game's own exported
 * sheet to float precision — and it is asserted BOTH ways: with the field ignored, the same six
 * heroes over-recover and are blocked, so the capture proves the mechanic rather than tolerating it.
 *
 * Minato (rank-20 Ponta de Diamante) is also the witness that the ability adds flat points
 * outside the pool — his exported 64.1 reproduces exactly once it is modelled that way
 * (`ponta-diamante-flat.test.ts`), so no cell is held out of the round-trip below and every issue
 * list is empty.
 */
import { describe, expect, it } from 'vitest';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { parseAccountPayload, type ImportCandidate } from '@bombfarm/domain/import-save';
import { SHEET_DISPLAY_KEYS, SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { spentPointsOf } from '@bombfarm/domain/point-inference';
import { WIKI_RUNES } from '@bombfarm/domain/phase-wiki';
import { runesOf, RUNE_AXES } from '@bombfarm/domain/runes';
import { capSheetValue } from '@bombfarm/domain/sheet-view';
import { buildStatBreakdown, foldLedger, type PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import { assertInRegime } from './helpers/capture-regime';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';
import { teamPlanInputFromFixture } from './helpers/team-plan-fixtures';

const FILE = 'payload-20260913-20heroes-runes.json';
assertInRegime(`sheet-math/${FILE}`, 'sheet');

const payload = loadFixtureJson(FILE);
const parsed = parseAccountPayload(payload as never, []);
const RUNED = ['Jon', 'WB;KE', 'Bellatrix', 'Minato', 'Edda', 'Korin'];

function budgetOf(candidate: ImportCandidate): number {
  return Math.max(0, candidate.level - (candidate.record.statPointsAvailable ?? 0));
}

describe('the 2026-09-13 live read — runes modelled', () => {
  it('non-vacuity: twenty heroes, six of them runed, one on all eight axes', () => {
    expect(parsed.rejected).toBeNull();
    expect(parsed.candidates).toHaveLength(20);
    const runed = parsed.candidates.filter((c) => runesOf(c.record).length > 0).map((c) => c.name);
    expect(runed).toEqual(RUNED);
    const bellatrix = parsed.candidates.find((c) => c.name === 'Bellatrix')!;
    expect(new Set(runesOf(bellatrix.record).map((rune) => rune.axis))).toEqual(new Set(RUNE_AXES));
  });

  it('every rune is rarity 0 at the published rarity-0 strength, with play time left', () => {
    for (const candidate of parsed.candidates) {
      for (const rune of runesOf(candidate.record)) {
        expect(rune.rarity).toBe(0);
        expect(rune.strengthPct).toBeCloseTo(WIKI_RUNES.strengthByRarity[rune.rarity] * 100, 12);
        expect(rune.playSecondsLeft).toBeGreaterThan(0);
        expect(rune.playSecondsLeft).toBeLessThanOrEqual(WIKI_RUNES.capPlaySecs);
      }
    }
  });

  it('no hero is blocked, and every one recovers exactly its budget', () => {
    expect(parsed.candidates.filter((c) => c.blocked).map((c) => c.name)).toEqual([]);
    for (const candidate of parsed.candidates) {
      expect(spentPointsOf(candidate.record.pts), candidate.name).toBe(budgetOf(candidate));
    }
  });

  it('the six runed heroes invert with no issue at all', () => {
    for (const candidate of parsed.candidates) {
      expect(candidate.pointIssues, candidate.name).toEqual([]);
    }
  });

  it('composing the recovered points back with the runes reproduces the exported sheet to 1e-9', () => {
    const tree = treeTotalsFromSave((payload.skills as Record<string, unknown>).totals as Record<string, unknown>);
    for (const candidate of parsed.candidates) {
      const hero = extractHero(payload, candidate.name, candidate.level);
      const composed = composeSheetFromBirth({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts: candidate.record.pts,
        tree,
        runes: candidate.record.runes,
      });
      for (const key of SHEET_KEYS) {
        const observed = hero.sheet[key];
        const relative = Math.abs(capSheetValue(key, composed[key]) - observed) / Math.max(1, Math.abs(observed));
        expect(relative, `${candidate.name}.${key}`).toBeLessThan(1e-9);
      }
    }
  });
});

describe('the per-statistic breakdown on this read', () => {
  const tree = (payload.skills as { totals: Record<string, number> }).totals;
  const bellatrix = parsed.candidates.find((c) => c.name === 'Bellatrix')!;
  const record = bellatrix.record;
  const combat = computeAdvisorPipeline({
    naked: record.naked,
    geared: record.gearedOverride,
    loadout: record.loadout,
    altLoadout: null,
    pts: record.pts,
    abilities: record.abilities,
    rarity: record.rarity,
    level: record.level,
    stars: record.stars,
    treeDanoTotal: tree.dmg_static,
    treeCritChance: tree.crit_chance_add * 100,
    treeCritDmg: tree.crit_dmg_add * 100,
    treeSpeed: tree.speed_add * 100,
    treeEnergy: tree.energia_add * 100,
    treeLuckFlatPct: tree.luck_add * 100,
    teamBuffs: zeroTeamBuffs(),
    houseIdx: 3,
    houseLevel: 18,
    phase: 91,
    mitigationPct: 10,
    rankMode: 'dps',
    targetProp: null,
    birth: record.birth,
    runes: record.runes,
  });
  const facts: PipelineFacts = {
    geared: record.gearedOverride,
    adjusted: combat.adjusted,
    pts: record.pts,
    delta: combat.pointDelta,
    effective: combat.effective,
    mods: combat.mods,
    sheetOther: combat.sheetOther,
    naked: record.naked,
    level: record.level,
    stars: record.stars,
    attackMult: combat.attackMult,
    energyMult: combat.energyMult,
    speedMult: combat.speedMult,
    teamCritFlat: combat.teamCritFlat,
    treeSpeed: tree.speed_add * 100,
    treeCritChance: tree.crit_chance_add * 100,
    treeCritDmg: tree.crit_dmg_add * 100,
    treeEnergy: tree.energia_add * 100,
    treeLuckFlatPct: tree.luck_add * 100,
    context: combat.context,
    dmgMult: combat.dmgMult,
    treeDanoTotal: tree.dmg_static,
    extraDmgPct: 0,
    active: combat.active,
    dps: combat.dps,
    uptime: combat.uptime,
    rest: combat.rest,
    runes: record.runes,
  };

  it('every sheet ledger still folds to the effective value on a hero runed on all six sheet axes', () => {
    for (const key of SHEET_DISPLAY_KEYS) {
      const breakdown = buildStatBreakdown(key, facts);
      if (breakdown.kind !== 'ledger') throw new Error(`${key} is not a ledger`);
      expect(Math.abs(foldLedger(breakdown.steps) - facts.effective[key]), key).toBeLessThan(1e-6);
    }
  });

  it('carries one ×1.05 rune step per runed statistic, with the play time left, and none on penetration', () => {
    for (const key of SHEET_DISPLAY_KEYS) {
      const breakdown = buildStatBreakdown(key, facts);
      if (breakdown.kind !== 'ledger') throw new Error(`${key} is not a ledger`);
      const runeSteps = breakdown.steps.filter((step) => step.source === 'rune');
      if (key === 'penetration') {
        expect(runeSteps).toEqual([]);
        continue;
      }
      expect(runeSteps, key).toHaveLength(1);
      expect(runeSteps[0].op).toBe('×');
      expect(runeSteps[0].amount).toBeCloseTo(1.05, 12);
      expect(runeSteps[0].runePlaySecondsLeft).toBeGreaterThan(0);
    }
  });

  it('crit damage: the rune step sits before the tree line, where the game puts it', () => {
    const breakdown = buildStatBreakdown('critDmg', facts);
    if (breakdown.kind !== 'ledger') throw new Error('not a ledger');
    const sources = breakdown.steps.map((step) => step.source);
    expect(sources.indexOf('rune')).toBeLessThan(sources.indexOf('tree'));
    expect(sources.indexOf('points')).toBeLessThan(sources.indexOf('rune'));
  });
});

describe('the optimizer on this read', () => {
  it('names the runed heroes in scope, and none of the others, so no gain is justified by a rune unnamed', () => {
    const input = teamPlanInputFromFixture(FILE);
    // Two heroes are enough for the list and keep the search short: one runed on the sheet
    // (Jon, attack) and one runed only off it (a fresh gold rune on WB;PA, who carries none).
    const jon = input.heroes.find((hero) => hero.name === 'Jon')!;
    const wbpa = input.heroes.find((hero) => hero.name === 'WB;PA')!;
    wbpa.runes = [{ axis: 'gold', strengthPct: 5, playSecondsLeft: 80_000, rarity: 0 }];
    input.heroes = [jon, wbpa];
    input.inventory = input.inventory.filter((item) => item.equippedBy === jon.heroId || item.equippedBy === wbpa.heroId);
    input.scopeByHeroId = { [jon.heroId]: 'optimize', [wbpa.heroId]: 'optimize' };
    const result = runTeamPlan(input);
    if (result.blocked) throw new Error(`expected a plan, got ${JSON.stringify(result)}`);
    expect(result.plan.runedHeroNames).toEqual(['Jon']);
  });
});

describe('the same read with the rune field ignored', () => {
  const blind = parseAccountPayload(
    {
      ...payload,
      heroes: (payload.heroes as Record<string, unknown>[]).map(({ runas: _runas, ...hero }) => hero),
    } as never,
    [],
  );

  it('blocks exactly the six runed heroes and no other — the field is what the fixture witnesses', () => {
    expect(blind.candidates.filter((c) => c.blocked).map((c) => c.name)).toEqual(RUNED);
    for (const candidate of blind.candidates) {
      if (RUNED.includes(candidate.name)) {
        expect(candidate.issues.some((issue) => issue.startsWith('Recovered ')), candidate.name).toBe(true);
      }
    }
  });
});
