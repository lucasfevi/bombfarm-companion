import { POINT_GAIN } from '../model';
import {
  EPS,
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

const TEMPO_FACTOR = 1.33333;

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
  // AD-BSP-22 + correction 2: energia_add multiplies the Hero+Gear subtotal; Glass Cannon's
  // energy ×0.5 (C15) now folds into the SAME sheet-level multiplier (applySkillTree) — it is
  // no longer a later combat mult (computeCombatMults.energyMult is fixed at 1). Peel it back
  // out of the observed `geared` value before the shared gear/tree split below (a pure
  // multiplicative chain, so dividing it out is exact), then re-apply it as its own labelled
  // step so pushBirthThenGear's 'gear' step still isolates pure gear, not Glass Cannon.
  const glassCannonFactor = facts.treeGlassCannon ? 0.5 : 1;
  const factsForSplit: PipelineFacts = facts.geared
    ? { ...facts, geared: { ...facts.geared, energy: facts.geared.energy / glassCannonFactor } }
    : facts;
  pushBirthThenGear(steps, 'energy', factsForSplit, facts.treeEnergy);
  pushMul(steps, 'tree', glassCannonFactor, facts.treeGlassCannon ? 'glassCannon' : undefined);
  pushAdd(steps, 'points', facts.pts.energy * facts.delta.energy);
  return { kind: 'ledger', total: facts.effective.energy, steps };
}

export function ledgerSpeed(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  const baseSpeed = facts.naked.speed / (1 + facts.sheetOther.speed);
  // Correction 3: Tempo Dobrado (V15) replaces the shared pool's implicit "1" with the
  // measured 1.33333 literal — an ADDITIVE term on the SAME birth base as speed_add, applied
  // once in applySkillTree. It is no longer a combat multiplier on the whole running total
  // (computeCombatMults.speedMult no longer carries it). Peel it back out of the observed
  // `geared` value before the shared gear/tree split below, so the 'gear' step still isolates
  // pure gear and the speed_add percent stays exactly what the tree reported, uncontaminated —
  // then re-apply the tempo amount as its own labelled step.
  const tempoAmount = baseSpeed * ((facts.treeTempoDobrado ? TEMPO_FACTOR : 1) - 1);
  const factsForSplit: PipelineFacts = facts.geared
    ? { ...facts, geared: { ...facts.geared, speed: facts.geared.speed - tempoAmount } }
    : facts;
  // AD-BSP-19/22: speed_add joins the shared pool — pushBirthThenGear now carries the 'tree'
  // step, split from the observed gear delta rather than added on top of it (AC-41).
  pushBirthThenGear(steps, 'speed', factsForSplit, facts.treeSpeed);
  if (Math.abs(tempoAmount) >= EPS) {
    pushAdd(steps, 'tree', tempoAmount, 'tempoDobrado');
  }
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
  const baseCrit = facts.naked.critChance / (1 + facts.sheetOther.critChance);
  // AD-BSP-19/22: crit_chance_add joins the shared pool — 'tree' now lives inside
  // pushBirthThenGear, split from the observed gear delta (AC-41).
  pushBirthThenGear(steps, 'critChance', facts, facts.treeCritChance);
  pushAddPctOfBase(
    steps,
    'points',
    facts.pts.critChance * POINT_GAIN.critChancePctOfBase * 100,
    baseCrit,
  );
  pushAddPctOfBase(steps, 'abilities', facts.mods.combatCritChancePctOfBase, baseCrit);
  pushAddPctOfBase(steps, 'team', facts.teamCritPctOfBase, baseCrit);
  return { kind: 'ledger', total: facts.effective.critChance, steps };
}

export function ledgerCritDmg(facts: PipelineFacts): StatBreakdown {
  const steps: LedgerStep[] = [];
  const baseCritDmg = facts.naked.critDmg / (1 + facts.sheetOther.critDmg);
  // Correction 1: Glass Cannon's crit_dmg_mult (2 when C15 owned) replaces the shared pool's
  // implicit "1" — an ADDITIVE term on the SAME base as crit_dmg_add, applied once in
  // applySkillTree. It no longer lives in a later combat pushMul
  // (computeCombatMults.critDmgMult is fixed at 1 now — the old form here scaled the WHOLE
  // running total, including the ability/tree/point contributions, which is not what the game
  // does). Peel it back out of the observed `geared` value before the shared gear/tree split
  // below, so the 'gear' step still isolates pure gear (items never roll crit damage) and the
  // crit_dmg_add percent stays exactly what the tree reported — then re-apply it as its own
  // labelled step.
  const critDmgMultFactor = facts.treeGlassCannon ? 2 : 1;
  const glassCannonAmount = baseCritDmg * (critDmgMultFactor - 1);
  const factsForSplit: PipelineFacts = facts.geared
    ? { ...facts, geared: { ...facts.geared, critDmg: facts.geared.critDmg - glassCannonAmount } }
    : facts;
  // AD-BSP-19/22: crit_dmg_add joins the shared pool the same way — 'tree' now lives inside
  // pushBirthThenGear (AC-41).
  pushBirthThenGear(steps, 'critDmg', factsForSplit, facts.treeCritDmg);
  if (Math.abs(glassCannonAmount) >= EPS) {
    pushAdd(steps, 'tree', glassCannonAmount, 'glassCannon');
  }
  pushAddPctOfBase(
    steps,
    'points',
    facts.pts.critDmg * POINT_GAIN.critDmgPctOfBase * 100,
    baseCritDmg,
  );
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
  const baseCdr = facts.naked.cdr / (1 + facts.sheetOther.cdr);
  pushBirthThenGear(steps, 'cdr', facts);
  pushAddPctOfBase(
    steps,
    'points',
    facts.pts.cdr * POINT_GAIN.cdrPctOfBase * 100,
    baseCdr,
  );
  return { kind: 'ledger', total: facts.effective.cdr, steps };
}
