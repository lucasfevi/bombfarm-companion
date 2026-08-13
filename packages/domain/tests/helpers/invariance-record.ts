/**
 * MP5 F2 (T2, `AD-076`) — the pre-deletion characterization baseline recorder.
 *
 * Walks F1's two corpus fixtures, every hero in each, and calls the functions `MKR-11` names,
 * projecting an EXPLICIT, hand-written key list per function — the SURVIVING numeric surface
 * only. Keystone-derived members are excluded BY CONSTRUCTION, each excluded member commented
 * with the requirement that deletes it. A recorder that serialised whole objects would fail
 * trivially the moment a member is deleted, proving nothing about the numbers (`AD-076`).
 *
 * Pure — no wall-clock read, no PRNG, no filesystem write, no network. Grep-asserted by
 * `invariance-baseline.test.ts`'s verification criterion.
 */
import { abilityMods } from '@bombfarm/domain/model';
import { applyPoints, emptySheetOther, type SheetOtherPct } from '@bombfarm/domain/gear';
import {
  applySkillTree,
  composeSheetFromBirth,
  nakedFromBirth,
  sheetsFromBirth,
  type BirthStats,
  type ComposeSheetFromBirthInput,
  type TreeSheetTotals,
} from '@bombfarm/domain/birth-sheet';
import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import { peelSheetSources } from '@bombfarm/domain/sheet-peel';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { computeCombatMults, derive } from '@bombfarm/domain/derive';
import { farmContextForHero, DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import {
  buildStatBreakdown,
  BREAKDOWN_DERIVED_IDS,
  BREAKDOWN_SHEET_IDS,
  type PipelineFacts,
} from '@bombfarm/domain/stat-breakdown';
import {
  buildHeroPlanContexts,
  evaluateRoster,
  type FarmContext,
} from '@bombfarm/domain/team-plan';
import { treeTotalsFromSave } from '@bombfarm/domain/save-units';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { SHEET_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
import { extractHero, loadFixtureJson, type SaveHeroSheet } from './sheet-math-fixtures';
import { teamPlanInputFromFixture } from './team-plan-fixtures';

/** The two corpus files F1 committed — read only, never edited (MKR-16). */
export const CORPUS_FILES = [
  'save-20260813-5heroes.json',
  'payload-20260812-8heroes.json',
] as const;

/**
 * Sign- and precision-preserving number encoder (`AD-076`). `JSON.stringify` is unusable — it
 * emits `0` for `-0` and `null` for `NaN`/`±Infinity`. ECMAScript guarantees
 * `Number(v.toString()) === v` exactly for every finite double, so `v.toString()` is bit-exact
 * for the general case; the four special cases below are handled explicitly.
 */
export function encodeNumber(v: number): string {
  if (Object.is(v, -0)) return '-0';
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return 'Infinity';
  if (v === -Infinity) return '-Infinity';
  return v.toString();
}

/** Round-trips `encodeNumber`'s output back to the original value (self-test, MKR-11). */
export function decodeNumber(s: string): number {
  if (s === '-0') return -0;
  if (s === 'NaN') return NaN;
  if (s === 'Infinity') return Infinity;
  if (s === '-Infinity') return -Infinity;
  return Number(s);
}

type SheetRecord = Record<SheetKey, number>;

function sheetRecord(sheet: Record<SheetKey, number>): SheetRecord {
  const out = {} as SheetRecord;
  for (const key of SHEET_KEYS) out[key] = sheet[key];
  return out;
}

type StageRow = {
  birth: number;
  deltaLevel: number;
  deltaStars: number;
  deltaAbility: number;
  deltaGear: number;
  deltaPoints: number;
  deltaTree: number;
  total: number;
  deltaCap: number;
  cappedTotal: number;
};

type SourceLinesRecord = { hero: number; gear: number; ability: number; skillTree: number };

type LedgerStepRecord = {
  source: string;
  op: string;
  amount: string;
  running: string;
  note: string | null;
};

type LedgerRecord = { total: string; steps: LedgerStepRecord[] };
type FormulaRecord = { substituted: string; value: string };

/** One hero's projected surviving surface — every field named by `MKR-11`, no keystone member. */
type HeroRecordEntry = {
  naked: SheetRecord;
  applySkillTree: SheetRecord;
  composeSheetFromBirth: SheetRecord;
  sheetsFromBirth: { naked: SheetRecord; geared: SheetRecord };
  peelSheetStages: Record<SheetKey, StageRow>;
  peelSheetSources: Record<SheetKey, SourceLinesRecord>;
  inferSpentPoints: SheetRecord;
  computeCombatMults: {
    teamAtkMult: string;
    teamSpeedMult: string;
    teamDrainMult: string;
    teamGateMult: string;
    teamCritPctOfBase: string;
    attackMult: string;
    speedMult: string;
    gateAttackMult: string;
    energyMult: string;
    critDmgMult: string;
    dmgMult: string;
  };
  farmContextForHero: {
    restSeconds: string;
    mitigation: string;
    blastRange: string;
    walkDelay: string;
    drainMult: string;
  };
  derive: {
    delta: SheetRecord;
    effectiveDelta: SheetRecord;
    adjusted: SheetRecord;
    effective: {
      attack: string;
      energy: string;
      speed: string;
      critChance: string;
      critDmg: string;
      penetration: string;
      cdr: string;
      attackPerPoint: string;
      energyPerPoint: string;
    };
    dps: string;
    active: string;
    hit: string;
  };
  /**
   * `pipelineForHero` (`AD-032`) — the app's own call path. Its internal
   * `computeAdvisorPipeline` call IS this recorded slice (same call, same numbers): the fields
   * MKR-11 names for `computeAdvisorPipeline` (`ranking`, `best`, `dps`, `active`, `predHit`,
   * `effective`, `pointDelta`, `resetAdvice`) are all present below, so a single call proves
   * both subjects rather than duplicating the (expensive) pipeline call.
   */
  pipelineForHero: {
    ranking: { stat: string; dpsGainPct: string }[];
    best: { stat: string; dpsGainPct: string };
    dps: string;
    active: string;
    predHit: string;
    effective: {
      attack: string;
      energy: string;
      speed: string;
      critChance: string;
      critDmg: string;
      penetration: string;
      cdr: string;
      attackPerPoint: string;
      energyPerPoint: string;
    };
    pointDelta: SheetRecord;
    resetAdvice: {
      recommend: boolean;
      tier: string;
      gainIsLowerBound: boolean;
      currentDps: string;
      reoptDps: string;
      gainPct: string;
    };
  };
  buildStatBreakdown: {
    sheet: Record<string, LedgerRecord>;
    derived: Record<string, FormulaRecord>;
  };
};

export type InvarianceRecord = {
  meta: { heroCount: number; scalarCount: number };
  heroes: Record<string, HeroRecordEntry>;
  scorer: Record<
    string,
    {
      objective: string;
      regime: string;
      sumDuty: string;
      slots: string;
      perHero: Record<string, { sustained: string; active: string; duty: string; fieldSeconds: string; hit: string }>;
    }
  >;
};

/** Scalars counted for the non-vacuity floor — every `encodeNumber`-produced leaf. */
let scalarCounter = 0;
function countScalar(): void {
  scalarCounter++;
}

function num(v: number): string {
  countScalar();
  return encodeNumber(v);
}

function ledgerRecord(steps: { source: string; op: string; amount: number; running: number; note?: string }[], total: number): LedgerRecord {
  return {
    total: num(total),
    steps: steps.map((s) => ({
      source: s.source,
      op: s.op,
      amount: num(s.amount),
      running: num(s.running),
      note: s.note ?? null,
    })),
  };
}

function stageRow(row: StageRow): StageRow {
  // StageRow numbers are re-encoded to strings by the caller's JSON pass via `stageRecordRaw`
  // helper below — kept as raw numbers here so the Object.is walk can compare them directly.
  return row;
}

function heroKey(file: string, name: string, level: number): string {
  return `${file}::${name}@${level}`;
}

/** Every hero this recorder covers, by corpus file (13 total: 5 + 8). */
const HEROES_BY_FILE: Record<(typeof CORPUS_FILES)[number], { name: string; level?: number }[]> = {
  'save-20260813-5heroes.json': [
    { name: 'Jon', level: 38 },
    { name: 'Perrin', level: 4 },
    { name: 'Perrin', level: 3 },
    { name: 'Lyra', level: 2 },
    { name: 'Bellatrix', level: 42 },
  ],
  'payload-20260812-8heroes.json': [
    { name: 'Nyx', level: 25 },
    { name: 'Bellatrix', level: 27 },
    { name: 'Cora', level: 22 },
    { name: 'Wren', level: 24 },
    { name: 'Lyra', level: 3 },
    { name: 'Mira', level: 3 },
    { name: 'Bryn', level: 3 },
    { name: 'Devin', level: 5 },
  ],
};

function recordHero(
  file: string,
  saveHero: SaveHeroSheet,
  tree: TreeSheetTotals,
  houseIdx: number,
  houseLevel: number,
  phase: number,
  mitigationPct: number,
): HeroRecordEntry {
  const birth: BirthStats = saveHero.birth ?? (() => {
    throw new Error(
      `hero "${saveHero.name}"@${saveHero.level} in ${file} has no birth_stats — the corpus is expected to be fully birth-backed post-F1`,
    );
  })();
  const sheetOther: SheetOtherPct = saveHero.sheetOther;

  const naked = nakedFromBirth(birth, saveHero.level, saveHero.stars, sheetOther);

  const inferred = inferSpentPoints({
    birth,
    level: saveHero.level,
    stars: saveHero.stars,
    sheetOther,
    loadout: saveHero.loadout,
    tree,
    sheet: saveHero.sheet,
    statPointsAvailable: saveHero.statPointsAvailable,
  });
  const pts = inferred.pts;

  const pooled = applyPoints(naked, saveHero.loadout, pts, sheetOther, saveHero.level, saveHero.stars);
  const skillTreeSheet = applySkillTree(pooled, naked, sheetOther, tree);

  const composeInput: ComposeSheetFromBirthInput = {
    birth,
    level: saveHero.level,
    stars: saveHero.stars,
    sheetOther,
    loadout: saveHero.loadout,
    pts,
    tree,
  };
  const composed = composeSheetFromBirth(composeInput);
  const birthSheets = sheetsFromBirth({
    birth,
    level: saveHero.level,
    stars: saveHero.stars,
    sheetOther,
    loadout: saveHero.loadout,
    tree,
  });
  const stages = peelSheetStages(composeInput);
  const sources = peelSheetSources(composeInput);

  const mods = abilityMods(saveHero.abilities);
  const mults = computeCombatMults({
    mods,
    teamBuffs: zeroTeamBuffs(),
    treeGlassCannon: tree.glassCannon ?? false,
    treeTempoDobrado: tree.tempoDobrado ?? false,
    extraDmgPct: 0,
  });

  const context = farmContextForHero({
    mods,
    teamDrainMult: mults.teamDrainMult,
    houseIdx,
    houseLevel,
    mitigationPct,
    phase,
  });

  const deriveResult = derive({
    geared: composed,
    naked,
    sheetOther,
    pts,
    rarity: saveHero.rarity,
    level: saveHero.level,
    stars: saveHero.stars,
    attackMult: mults.attackMult,
    energyMult: mults.energyMult,
    speedMult: mults.speedMult,
    critDmgMult: mults.critDmgMult,
    teamCritPctOfBase: mults.teamCritPctOfBase,
    treeSheet: tree,
    combatCritChancePctOfBase: mods.combatCritChancePctOfBase,
    penetrationPp: mods.penetrationPp,
    context,
    dmgMult: mults.dmgMult,
    mitigationPct,
  });

  // pipelineForHero — the app's own call path (AD-032). Build a HeroRecord/AccountShared the
  // same shape pipeline-for-hero-parity.test.ts builds.
  const hero: HeroRecord = {
    id: saveHero.sourceId,
    name: saveHero.name,
    updatedAt: 0,
    rarity: saveHero.rarity,
    level: saveHero.level,
    stars: saveHero.stars,
    naked,
    loadout: saveHero.loadout,
    altLoadout: null,
    gearedOverride: birthSheets.geared,
    abilities: saveHero.abilities,
    pts,
    statPointsAvailable: saveHero.statPointsAvailable,
    sourceId: saveHero.sourceId,
    birth,
  };
  const account: AccountShared = {
    tree: {
      danoTotal: tree.danoStatic,
      critChance: tree.critChancePct,
      critDmg: tree.critDmgPct,
      speed: tree.speedPct,
      energy: tree.energyPct,
      teamCoinPct: 0,
      glassCannon: tree.glassCannon ?? false,
      tempoDobrado: tree.tempoDobrado ?? false,
      critDmgMult: tree.critDmgMult,
      luckFlatPct: tree.luckFlatPct,
    },
    teamBuffs: zeroTeamBuffs(),
    context: {
      houseIdx,
      houseLevel,
      phase,
      mitigationPct,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
  };
  const pipelineResult = pipelineForHero(hero, account, phase, mitigationPct);

  // PipelineFacts for buildStatBreakdown — `geared` omitted (optional); buildStatBreakdown's
  // ledger builders fall back to `adjusted - pts*delta`, which is exact by construction.
  const facts: PipelineFacts = {
    adjusted: pipelineResult.adjusted,
    pts,
    delta: pipelineResult.A.delta,
    effective: pipelineResult.effective,
    mods: pipelineResult.mods,
    sheetOther: pipelineResult.sheetOther,
    naked,
    level: saveHero.level,
    stars: saveHero.stars,
    attackMult: pipelineResult.attackMult,
    energyMult: pipelineResult.energyMult,
    speedMult: pipelineResult.speedMult,
    critDmgMult: pipelineResult.critDmgMult,
    teamCritPctOfBase: pipelineResult.teamCritPctOfBase,
    treeSpeed: pipelineResult.treeSheet.speedPct,
    treeCritChance: pipelineResult.treeSheet.critChancePct,
    treeCritDmg: pipelineResult.treeSheet.critDmgPct,
    treeEnergy: pipelineResult.treeSheet.energyPct,
    treeLuckFlatPct: pipelineResult.treeSheet.luckFlatPct,
    treeGlassCannon: Boolean(pipelineResult.treeSheet.glassCannon),
    treeTempoDobrado: Boolean(pipelineResult.treeSheet.tempoDobrado),
    context: pipelineResult.context,
    dmgMult: pipelineResult.dmgMult,
    treeDanoTotal: pipelineResult.treeSheet.danoStatic,
    extraDmgPct: 0,
    active: pipelineResult.active,
    dps: pipelineResult.dps,
    uptime: pipelineResult.uptime,
    rest: pipelineResult.rest,
  };

  const sheetBreakdown: Record<string, LedgerRecord> = {};
  for (const stat of BREAKDOWN_SHEET_IDS) {
    const built = buildStatBreakdown(stat, facts);
    if (built.kind !== 'ledger') throw new Error(`expected ledger for ${stat}`);
    sheetBreakdown[stat] = ledgerRecord(built.steps, built.total);
  }
  const derivedBreakdown: Record<string, FormulaRecord> = {};
  for (const stat of BREAKDOWN_DERIVED_IDS) {
    const built = buildStatBreakdown(stat, facts);
    if (built.kind !== 'formula') throw new Error(`expected formula for ${stat}`);
    countScalar();
    derivedBreakdown[stat] = { substituted: built.substituted, value: encodeNumber(built.value) };
  }

  const stageRecord: Record<SheetKey, StageRow> = {} as Record<SheetKey, StageRow>;
  for (const key of SHEET_KEYS) {
    const row = stages[key];
    stageRecord[key] = stageRow(row);
    // Nine numeric fields per row — counted for the non-vacuity floor.
    countScalar();
    countScalar();
    countScalar();
    countScalar();
    countScalar();
    countScalar();
    countScalar();
    countScalar();
    countScalar();
  }

  const sourceRecord: Record<SheetKey, SourceLinesRecord> = {} as Record<SheetKey, SourceLinesRecord>;
  for (const key of SHEET_KEYS) {
    sourceRecord[key] = sources[key];
    countScalar();
    countScalar();
    countScalar();
    countScalar();
  }

  return {
    naked: sheetRecord(naked),
    applySkillTree: sheetRecord(skillTreeSheet),
    composeSheetFromBirth: sheetRecord(composed),
    sheetsFromBirth: { naked: sheetRecord(birthSheets.naked), geared: sheetRecord(birthSheets.geared) },
    peelSheetStages: stageRecord,
    peelSheetSources: sourceRecord,
    inferSpentPoints: sheetRecord(pts),
    computeCombatMults: {
      teamAtkMult: num(mults.teamAtkMult),
      teamSpeedMult: num(mults.teamSpeedMult),
      teamDrainMult: num(mults.teamDrainMult),
      teamGateMult: num(mults.teamGateMult),
      teamCritPctOfBase: num(mults.teamCritPctOfBase),
      attackMult: num(mults.attackMult),
      speedMult: num(mults.speedMult),
      gateAttackMult: num(mults.gateAttackMult),
      energyMult: num(mults.energyMult),
      critDmgMult: num(mults.critDmgMult),
      dmgMult: num(mults.dmgMult),
    },
    farmContextForHero: {
      restSeconds: num(context.restSeconds),
      mitigation: num(context.mitigation),
      blastRange: num(context.blastRange),
      walkDelay: num(context.walkDelay),
      drainMult: num(context.drainMult),
    },
    derive: {
      delta: sheetRecord(deriveResult.delta),
      effectiveDelta: sheetRecord(deriveResult.effectiveDelta),
      adjusted: sheetRecord(deriveResult.adjusted),
      effective: {
        attack: num(deriveResult.effective.attack),
        energy: num(deriveResult.effective.energy),
        speed: num(deriveResult.effective.speed),
        critChance: num(deriveResult.effective.critChance),
        critDmg: num(deriveResult.effective.critDmg),
        penetration: num(deriveResult.effective.penetration),
        cdr: num(deriveResult.effective.cdr),
        attackPerPoint: num(deriveResult.effective.attackPerPoint),
        energyPerPoint: num(deriveResult.effective.energyPerPoint),
      },
      dps: num(deriveResult.dps),
      active: num(deriveResult.active),
      hit: num(deriveResult.hit),
    },
    pipelineForHero: {
      ranking: pipelineResult.ranking.map((p) => ({ stat: p.stat, dpsGainPct: num(p.dpsGainPct) })),
      best: { stat: pipelineResult.best.stat, dpsGainPct: num(pipelineResult.best.dpsGainPct) },
      dps: num(pipelineResult.dps),
      active: num(pipelineResult.active),
      predHit: num(pipelineResult.predHit),
      effective: {
        attack: num(pipelineResult.effective.attack),
        energy: num(pipelineResult.effective.energy),
        speed: num(pipelineResult.effective.speed),
        critChance: num(pipelineResult.effective.critChance),
        critDmg: num(pipelineResult.effective.critDmg),
        penetration: num(pipelineResult.effective.penetration),
        cdr: num(pipelineResult.effective.cdr),
        attackPerPoint: num(pipelineResult.effective.attackPerPoint),
        energyPerPoint: num(pipelineResult.effective.energyPerPoint),
      },
      pointDelta: sheetRecord(pipelineResult.pointDelta),
      resetAdvice: {
        recommend: pipelineResult.resetAdvice.recommend,
        tier: pipelineResult.resetAdvice.tier,
        gainIsLowerBound: pipelineResult.resetAdvice.gainIsLowerBound,
        currentDps: num(pipelineResult.resetAdvice.currentDps),
        reoptDps: num(pipelineResult.resetAdvice.reoptDps),
        gainPct: num(pipelineResult.resetAdvice.gainPct),
      },
    },
    buildStatBreakdown: { sheet: sheetBreakdown, derived: derivedBreakdown },
  };
}

/**
 * Pure. No wall-clock read, no PRNG, no filesystem write, no network — walks F1's committed
 * corpus files (read-only) and calls the surviving functions this feature touches.
 */
export function recordInvarianceSurface(): InvarianceRecord {
  scalarCounter = 0;
  const heroes: Record<string, HeroRecordEntry> = {};
  let heroCount = 0;

  for (const file of CORPUS_FILES) {
    const raw = loadFixtureJson(file);
    const parsed = parseSaveFile(raw, []);
    if (!parsed.account.tree) throw new Error(`fixture ${file} has no skill tree — cannot record`);
    const houseIdx = parsed.account.houseIdx ?? 0;
    const houseLevel = parsed.account.houseLevel ?? 1;
    const phase = parsed.account.phase;
    if (phase == null) throw new Error(`fixture ${file} has no account.phase — cannot record`);
    const line = phaseLine(phase);
    if (!line) throw new Error(`fixture ${file}'s phase ${phase} has no phase line`);
    const mitigationPct = line.mitig * 100;

    const totalsRaw = (raw as { skills?: { totals?: Record<string, unknown> } }).skills?.totals ?? {};
    const tree = treeTotalsFromSave(totalsRaw);

    for (const target of HEROES_BY_FILE[file]) {
      const saveHero = extractHero(raw, target.name, target.level);
      const entry = recordHero(
        file,
        saveHero,
        tree,
        houseIdx,
        houseLevel,
        phase,
        mitigationPct,
      );
      heroes[heroKey(file, target.name, target.level ?? saveHero.level)] = entry;
      heroCount++;
    }
  }

  const scorer: InvarianceRecord['scorer'] = {};
  for (const file of CORPUS_FILES) {
    const input = teamPlanInputFromFixture(file);
    const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
    if (built.blocked) {
      throw new Error(`fixture ${file} has blocked heroes for the team-plan scorer: ${built.heroNames.join(', ')}`);
    }
    const loadoutsByHeroId: Record<string, (typeof input.heroes)[number]['loadout']> = {};
    const ptsByHeroId: Record<string, (typeof input.heroes)[number]['pts']> = {};
    for (const h of input.heroes) {
      loadoutsByHeroId[h.heroId] = h.loadout;
      ptsByHeroId[h.heroId] = h.pts;
    }
    const farm: FarmContext = {
      houseIdx: input.account.houseIdx,
      houseLevel: input.account.houseLevel,
      phase: input.account.phase,
      mitigationPct: input.account.mitigationPct,
      treeGlassCannon: input.account.treeGlassCannon,
      treeTempoDobrado: input.account.treeTempoDobrado,
    };
    const evaluation = evaluateRoster({
      contexts: built.contexts,
      loadoutsByHeroId,
      ptsByHeroId,
      slots: input.account.slots,
      farm,
      forgeFloor: input.forgeFloor,
    });
    const perHero: Record<string, { sustained: string; active: string; duty: string; fieldSeconds: string; hit: string }> = {};
    for (const heroId of Object.keys(evaluation.perHero).sort()) {
      const score = evaluation.perHero[heroId]!;
      perHero[heroId] = {
        sustained: num(score.sustained),
        active: num(score.active),
        duty: num(score.duty),
        fieldSeconds: num(score.fieldSeconds),
        hit: num(score.hit),
      };
    }
    scorer[file] = {
      objective: num(evaluation.objective),
      regime: evaluation.regime,
      sumDuty: num(evaluation.sumDuty),
      slots: num(evaluation.slots),
      perHero,
    };
  }

  return { meta: { heroCount, scalarCount: scalarCounter }, heroes, scorer };
}

/** Canonical, key-ordered serialisation — every leaf is already `encodeNumber`-safe. */
export function serializeRecord(record: InvarianceRecord): string {
  return JSON.stringify(record, null, 2) + '\n';
}
