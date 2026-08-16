import { POINT_GAIN } from '../model';
import {
  pushAdd,
  pushAddPctOfBase,
  pushBase,
  pushBirthThenGear,
  pushMul,
  teamMultNote,
} from './ledger-kit';
import type {
  LedgerStep,
  PipelineFacts,
  StatBreakdown,
} from './types';

export function ledgerAttack(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  // AD-BSP-12: dmg_static (a raw multiplier) → percent form for pushBirthThenGear's uniform
  // contract, so the 'tree' step is sourced from the sheet, not added on top of it (AC-42).
  pushBirthThenGear(steps, 'attack', facts, (facts.treeDanoTotal - 1) * 100);
  pushAdd(steps, 'points', facts.pts.attack * facts.delta.attack);
  const { note, split } = teamMultNote(facts.attackMult, facts.mods.attackMult);
  pushMul(steps, 'abilitiesTeam', facts.attackMult, note, split);
  return { kind: 'ledger', total: facts.effective.attack, steps };
}

export function ledgerEnergy(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  // AD-BSP-22: energia_add multiplies the Hero+Gear subtotal.
  pushBirthThenGear(steps, 'energy', facts, facts.treeEnergy);
  pushAdd(steps, 'points', facts.pts.energy * facts.delta.energy);
  return { kind: 'ledger', total: facts.effective.energy, steps };
}

export function ledgerSpeed(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  const baseSpeed = facts.naked.speed / (1 + facts.sheetOther.speed);
  // AD-BSP-19/22: speed_add joins the shared pool — pushBirthThenGear carries the 'tree'
  // step, split from the observed gear delta rather than added on top of it (AC-41).
  pushBirthThenGear(steps, 'speed', facts, facts.treeSpeed);
  pushAddPctOfBase(
    steps,
    'points',
    facts.pts.speed * POINT_GAIN.speedPctOfBase * 100,
    baseSpeed,
  );

  const { note, split } = teamMultNote(facts.speedMult, facts.mods.speedMult);
  pushMul(steps, 'abilitiesTeam', facts.speedMult, note, split);
  return { kind: 'ledger', total: facts.effective.speed, steps };
}

export function ledgerCritChance(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  // Every crit-chance source is a FLAT planner-percentage-point addend as of the 2026-08-15
  // patch — points, the combat/team abilities, and the tree line inside pushBirthThenGear.
  // No `pctOfBase` provenance is left to report on any of them.
  pushBirthThenGear(steps, 'critChance', facts, facts.treeCritChance);
  pushAdd(steps, 'points', facts.pts.critChance * POINT_GAIN.critChanceFlat);
  pushAdd(steps, 'abilities', facts.mods.combatCritChanceFlat);
  pushAdd(steps, 'team', facts.teamCritChanceFlat);
  return { kind: 'ledger', total: facts.effective.critChance, steps };
}

export function ledgerCritDmg(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  // AD-BSP-22: crit_dmg_add still joins the shared pool — 'tree' lives inside
  // pushBirthThenGear (AC-41). The POINTS line does not: crit-damage points are flat
  // (POINT_GAIN.critDmgFlat), so this is a plain add with no `pctOfBase` provenance.
  pushBirthThenGear(steps, 'critDmg', facts, facts.treeCritDmg);
  pushAdd(steps, 'points', facts.pts.critDmg * POINT_GAIN.critDmgFlat);
  return { kind: 'ledger', total: facts.effective.critDmg, steps };
}

export function ledgerPenetration(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  const basePen = facts.naked.penetration / (1 + facts.sheetOther.penetration);
  pushBirthThenGear(steps, 'penetration', facts);
  pushAddPctOfBase(
    steps,
    'points',
    facts.pts.penetration * POINT_GAIN.penetrationPctOfBase * 100,
    basePen,
  );
  pushAdd(steps, 'abilities', facts.mods.penetrationPp);
  return { kind: 'ledger', total: facts.effective.penetration, steps };
}

/**
 * Luck's ledger (`AC-22`, `DEC-06`) — the shortest of the eight stats, and the one that makes
 * `AC-29`'s four lines legible in a single stat: Hero (birth roll, already star-scaled — `naked`
 * is tree-free per Wave 5's `nakedFromBirth`), Gear (`gearSortePct`), Ability — always 0 since
 * Olho Lapidador is `{ kind: 'none' }` (`BSP-47`) but pushed explicitly (unlike `pushAdd`'s
 * near-zero skip) so the line renders, Points (`pts.luck × luckPctOfBase × naked.luck`,
 * `derive.ts`'s own `delta.luck` formula) and Skill tree (`luck_add`, a FLAT percentage-point
 * addend — `AD-BSP-22`, the one shape that differs from every other stat's shared-pool tree
 * term). `facts.geared` (when present) is tree-inclusive, points-free, matching every other
 * ledger's `gearedFor` convention — the gear step peels the tree amount back out of it. Without
 * `facts.geared`, the residual `adjusted.luck − pointsAmount` is exact by construction, because
 * production's `derive()` computes `adjusted.luck = geared.luck + pts.luck × delta.luck`.
 */
export function ledgerLuck(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  const nakedLuck = facts.naked.luck;
  pushBase(steps, nakedLuck);

  const pointsAmount = facts.pts.luck * POINT_GAIN.luckPctOfBase * nakedLuck;
  const treeAmount = facts.treeLuckFlatPct;
  const gearedLuck = facts.geared ? facts.geared.luck : facts.adjusted.luck - pointsAmount;
  const pureGearAmount = gearedLuck - treeAmount - nakedLuck;
  pushAdd(steps, 'gear', pureGearAmount);

  // BSP-47: Olho Lapidador (Luck's only sheet ability) is `{ kind: 'none' }` — always zero.
  // Pushed explicitly so the Ability line renders even at 0, matching the game's own tooltip
  // (AC-22, AC-29). `pushAdd` would silently skip a near-zero amount; this does not.
  const afterGear = steps.at(-1) ?? steps[0];
  steps.push({ source: 'sheetAbilities', op: '+', amount: 0, running: afterGear.running });

  pushAdd(steps, 'points', pointsAmount);
  pushAdd(steps, 'tree', treeAmount);

  return { kind: 'ledger', total: facts.adjusted.luck, steps };
}

export function ledgerCdr(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  // Flat since the 2026-08-15 patch, same as crit chance — and CDR has no ability or tree line
  // at all, so gear and points are the only additions.
  pushBirthThenGear(steps, 'cdr', facts);
  pushAdd(steps, 'points', facts.pts.cdr * POINT_GAIN.cdrFlat);
  return { kind: 'ledger', total: facts.effective.cdr, steps };
}
