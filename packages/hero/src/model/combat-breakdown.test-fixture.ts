/**
 * One hero's pipeline facts from the domain's own committed save corpus, priced on its own seat
 * the way the two Combat stages price it — so a test here renders the same figures the screens
 * do, and a value drifting in the domain fails here rather than only in a browser.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { alcanceForExplosaoAmpla, effectiveReachForExplosaoAmpla } from '@bombfarm/domain/game-power';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { phaseLine } from '@bombfarm/domain/phases';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import type { PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import {
  computeTeamBuffsAroundHero,
  entryPulseRankFloor,
  fieldAlliesAroundHero,
  noTeamAuraSwitches,
  type TeamAuraSwitches,
} from '@bombfarm/domain/team-buffs';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../domain/tests/fixtures/sheet-math');

export const BREAKDOWN_FIXTURE = 'save-20260825-11heroes-one-shot-spread.json';

export type BreakdownFixture = {
  heroes: HeroRecord[];
  account: Omit<AccountShared, 'teamBuffs' | 'fieldAllies'>;
  phase: number;
  mitigationPct: number;
};

export function loadBreakdownFixture(filename: string = BREAKDOWN_FIXTURE): BreakdownFixture {
  const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, filename), 'utf8')) as Record<string, unknown>;
  const parsed = parseAccountPayload(raw, []);
  if (parsed.rejected) throw new Error(`fixture "${filename}" was rejected: ${parsed.rejected.reason}`);
  const data = parsed.account;
  if (!data.tree) throw new Error('fixture must carry a skill tree');
  const phase = data.phase;
  if (phase == null) throw new Error('fixture must carry account.phase');
  const line = phaseLine(phase);
  if (!line) throw new Error('fixture phase has no phase line');

  const heroes: HeroRecord[] = parsed.candidates.map((candidate, index) => ({
    ...candidate.record,
    id: candidate.sourceId,
    updatedAt: index,
  }));
  const account: BreakdownFixture['account'] = {
    tree: {
      danoTotal: data.tree.danoTotal,
      critChance: data.tree.critChance,
      critDmg: data.tree.critDmg,
      speed: data.tree.speed,
      energy: data.tree.energy,
      teamCoinPct: data.tree.teamCoinPct ?? 0,
      luckFlatPct: data.tree.luckFlatPct,
      ...(data.tree.xpMult !== undefined ? { xpMult: data.tree.xpMult } : {}),
    },
    context: {
      houseIdx: data.houseIdx ?? 0,
      houseLevel: data.houseLevel ?? 1,
      phase,
      mitigationPct: line.mitig * 100,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
    ...(data.slots != null ? { slots: data.slots } : {}),
    fieldSlots: data.fieldSlots ?? null,
    houseCycleSecs: data.houseCycleSecs ?? null,
    maxPhase: data.maxPhase ?? null,
  };
  return { heroes, account, phase, mitigationPct: line.mitig * 100 };
}

/**
 * The fixtures were captured before the 2026-09-26 patch that halved Wide Blast's extra cells, so
 * their stored Power counts those cells whole. This is the same figure as the game scores it now.
 */
export function storedPowerAfterWideBlastNerf(hero: Pick<HeroRecord, 'name' | 'power' | 'abilities'>): number {
  if (hero.power === undefined) throw new Error(`${hero.name} carries no stored power`);
  const level = hero.abilities?.explosao_ampla ?? 0;
  const wholeCellRange = 1 + 0.5 * alcanceForExplosaoAmpla(level);
  const halvedCellRange = 1 + 0.5 * effectiveReachForExplosaoAmpla(level);
  return hero.power * (halvedCellRange / wholeCellRange);
}

export function fixtureHero(fixture: BreakdownFixture, name: string): HeroRecord {
  const hero = fixture.heroes.find((candidate) => candidate.name === name);
  if (!hero) throw new Error(`fixture hero "${name}" not found`);
  return hero;
}

/** The facts the Combat stages hand the panel: one hero on its own seat, at the fixture's phase. */
export function factsForHero(
  fixture: BreakdownFixture,
  hero: HeroRecord,
  switches: TeamAuraSwitches = noTeamAuraSwitches(),
  phase: number = fixture.phase,
): PipelineFacts {
  const seat: AccountShared = {
    ...fixture.account,
    context: { ...fixture.account.context, phase },
    teamBuffs: computeTeamBuffsAroundHero(hero, switches),
    entryPulseRankFloor: entryPulseRankFloor(switches),
    fieldAllies: fieldAlliesAroundHero(hero, fixture.heroes),
  };
  const mitigationPct = phaseLine(phase)?.mitig;
  if (mitigationPct === undefined) throw new Error(`phase ${phase} has no phase line`);
  const combat = pipelineForHero(hero, seat, phase, mitigationPct * 100);
  return {
    geared: hero.gearedOverride,
    adjusted: combat.adjusted,
    pts: hero.pts,
    delta: combat.pointDelta,
    effective: combat.effective,
    mods: combat.mods,
    sheetOther: combat.sheetOther,
    naked: hero.naked,
    level: hero.level,
    stars: hero.stars,
    attackMult: combat.attackMult,
    energyMult: combat.energyMult,
    speedMult: combat.speedMult,
    teamCritFlat: combat.teamCritFlat,
    teamPenFlat: combat.teamPenFlat,
    packMult: combat.packMult,
    entryPulseMult: combat.entryPulse.expectedMult,
    treeSpeed: fixture.account.tree.speed,
    treeCritChance: fixture.account.tree.critChance,
    treeCritDmg: fixture.account.tree.critDmg,
    treeEnergy: fixture.account.tree.energy,
    treeLuckFlatPct: combat.treeSheet.luckFlatPct,
    context: combat.context,
    dmgMult: combat.hitMult * combat.entryPulse.expectedMult,
    treeDanoTotal: fixture.account.tree.danoTotal,
    extraDmgPct: 0,
    active: combat.active,
    dps: combat.dps,
    uptime: combat.uptime,
    rest: combat.rest,
    runes: hero.runes,
  };
}
