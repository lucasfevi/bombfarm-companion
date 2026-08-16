import { levelPowerMult } from '../model';
import { starsMult, type SheetOtherPct } from '../gear';
import { TEAM_MULT_BONUS_CAP } from '../derive';
import type { SheetDisplayKey } from '../planner-constants';
import type {
  LedgerNote,
  LedgerSource,
  LedgerStep,
  PipelineFacts,
} from './types';

export const EPS = 1e-9;

export function formatBreakdownNumber(value: number, digits: number): string {
  return value.toFixed(digits);
}

export function gearedFor(statKey: SheetDisplayKey, facts: PipelineFacts): number {
  if (facts.geared) return facts.geared[statKey];
  return facts.adjusted[statKey] - facts.pts[statKey] * facts.delta[statKey];
}

function otherFactor(percent: number): number {
  return 1 + Math.max(0, percent);
}

/**
 * The MULTIPLICATIVE sheet-ability share for this key, as a fraction of the roll. Only `speed`
 * and `penetration` still have one — `critChance`, `critDmg` and `cdr` are deliberately 0 here,
 * their sheet abilities being flat addends reported by {@link sheetAbilityFlatFor} instead
 * (see `POINT_GAIN.critChanceFlat` / `.critDmgFlat` / `.cdrFlat`).
 */
function sheetOtherFor(statKey: SheetDisplayKey, otherPct: SheetOtherPct): number {
  switch (statKey) {
    case 'speed':
      return otherPct.speed;
    case 'penetration':
      return otherPct.penetration;
    case 'critChance':
    case 'cdr':
    case 'critDmg':
    case 'attack':
    case 'energy':
      return 0;
  }
}

/**
 * The FLAT sheet-ability addend for this key (planner units). Crit chance (Olho Clínico) and
 * crit damage (Golpe Brutal) have one; CDR's slot exists but the game emits no cooldown ability.
 */
function sheetAbilityFlatFor(statKey: SheetDisplayKey, otherPct: SheetOtherPct): number {
  switch (statKey) {
    case 'critChance':
      return Math.max(0, otherPct.critChanceFlat);
    case 'critDmg':
      return Math.max(0, otherPct.critDmgFlat);
    case 'cdr':
      return Math.max(0, otherPct.cdrFlat);
    default:
      return 0;
  }
}

/**
 * Reconstruct lv1 ★0 roll by peeling level / stars / sheet-ability factors from naked.
 *
 * `naked` here is today's contaminated (tree-inclusive) value (GAP-W4-01) — this function
 * deliberately gains NO tree divisor (DEC-03, consistent with `derive`'s `AC-37`). The
 * returned "birth" figure therefore still carries a residual tree contamination until Wave 5
 * writes a genuinely tree-free `naked` via `nakedFromBirth`; `pushBirthThenGear`'s tree/gear
 * split (below) works regardless, because it is anchored to the *observed* `naked`/`geared`
 * values rather than to this peeled figure.
 */
export function birthFromNaked(statKey: SheetDisplayKey, facts: PipelineFacts): number {
  // Peel the flat sheet-ability addend (crit damage only) before the multiplicative peels.
  const naked = facts.naked[statKey] - sheetAbilityFlatFor(statKey, facts.sheetOther);
  const levelMult = levelPowerMult(facts.level);
  const starMult = starsMult(facts.stars);
  const otherMult = otherFactor(sheetOtherFor(statKey, facts.sheetOther));
  switch (statKey) {
    case 'attack':
      return naked / (levelMult * starMult);
    case 'energy':
      return naked / starMult;
    case 'speed':
      return naked / otherMult;
    case 'critChance':
    case 'critDmg':
    case 'penetration':
    case 'cdr':
      return naked / (otherMult * starMult);
  }
}

function sheetAbilityNote(statKey: SheetDisplayKey): LedgerNote | undefined {
  if (statKey === 'critChance') return 'keenEye';
  if (statKey === 'penetration') return 'diamondTip';
  if (statKey === 'critDmg') return 'brutalStrike';
  return undefined;
}

/**
 * Birth roll (lv1 ★0) → level → stars → sheet abilities (Olho / Ponta) → gear → tree.
 * Running total after sheet abilities equals naked[statKey]; after gear+tree it equals
 * geared[statKey] (BSPW4-06, AC-40/41/42).
 *
 * `treePct` is the skill-tree contribution for this key, in the SAME percent units for every
 * key: `energia_add`/`speed_add`/`crit_chance_add`/`crit_dmg_add` are already percent
 * (`TreeSheetTotals.*Pct`); `dmg_static` (a raw multiplier) is converted by the caller to
 * `(danoStatic − 1) × 100` so this function has one uniform contract.
 *
 * Two placements, matching AD-BSP-12/22 (`BSP-23c`, single application):
 * - **attack / energy** — tree multiplies the WHOLE Hero+Gear(+Ability) subtotal. Pure gear is
 *   recovered by DIVIDING the tree factor out of the observed `geared` value (not subtracting),
 *   then the 'tree' step is a `pushMul` on top of that pure subtotal — sourced from the sheet,
 *   not an independent add-on (AC-41, AC-42).
 * - **speed / critChance / critDmg** — tree joins the SAME additive shared pool as gear
 *   (AD-BSP-19). The observed `geared − naked` delta is split into the tree's own share
 *   (`treePct% × pool base`) and the remainder, which is the true gear contribution — both
 *   pushed as separate steps off the same base, so no cross term is introduced.
 * - **penetration / cdr** — `treePct` is always 0 (AD-BSP-22); the split degenerates to the
 *   original ungear-only behaviour.
 */
export function pushBirthThenGear(
  steps: LedgerStep[],
  statKey: SheetDisplayKey,
  facts: PipelineFacts,
  treePct = 0,
): void {
  const naked = facts.naked[statKey];
  pushBase(steps, birthFromNaked(statKey, facts));
  if (statKey === 'attack') {
    pushMul(steps, 'level', levelPowerMult(facts.level));
  }
  if (statKey !== 'speed') {
    pushMul(steps, 'stars', starsMult(facts.stars));
  }
  const other = sheetOtherFor(statKey, facts.sheetOther);
  if (other > EPS) {
    pushMul(steps, 'sheetAbilities', otherFactor(other), sheetAbilityNote(statKey));
  }
  // Crit damage's sheet ability (Golpe Brutal) is a flat addend, not a pool factor.
  const abilityFlat = sheetAbilityFlatFor(statKey, facts.sheetOther);
  if (abilityFlat > EPS) {
    pushAdd(steps, 'sheetAbilities', abilityFlat, sheetAbilityNote(statKey));
  }

  const gearedValue = gearedFor(statKey, facts);
  // Energy: geared = naked × (1 + energyPct) → delta = energyPct × naked.
  // Shared pool: geared − naked = gearPct × (naked / (1+other)).
  const base = statKey === 'energy' ? naked : (naked - abilityFlat) / otherFactor(other);

  if (statKey === 'attack' || statKey === 'energy') {
    const treeMult = 1 + treePct / 100;
    const pureGeared = Math.abs(treeMult) > EPS ? gearedValue / treeMult : gearedValue;
    const gearDelta = pureGeared - naked;
    if (statKey === 'attack') {
      pushAdd(steps, 'gear', gearDelta);
    } else if (Math.abs(base) < EPS) {
      pushAdd(steps, 'gear', gearDelta);
    } else {
      pushAddPctOfBase(steps, 'gear', (gearDelta / base) * 100, base);
    }
    pushMul(steps, 'tree', treeMult);
    return;
  }

  // Crit chance's tree term is a FLAT planner-pp addend since the 2026-08-15 patch, so it takes
  // no `× base` and reports no `pctOfBase` provenance. Crit damage's tree term keeps the
  // percent-of-base shape (`AD-BSP-22`) — it is the last one left, and unmeasured (see
  // `applySkillTree`). CDR has no tree node at all, so `treePct` is 0 for it either way.
  const treeIsFlat = statKey === 'critChance' || statKey === 'cdr';
  const treeAmount = treeIsFlat ? treePct : (treePct / 100) * base;
  const gearDelta = gearedValue - naked - treeAmount;
  if (statKey === 'critDmg' || statKey === 'critChance' || statKey === 'cdr' || Math.abs(base) < EPS) {
    pushAdd(steps, 'gear', gearDelta);
  } else {
    pushAddPctOfBase(steps, 'gear', (gearDelta / base) * 100, base);
  }
  if (treeIsFlat) {
    pushAdd(steps, 'tree', treeAmount);
  } else {
    pushAddPctOfBase(steps, 'tree', treePct, base);
  }
}

export function pushBase(steps: LedgerStep[], base: number): void {
  steps.push({ source: 'base', op: '+', amount: base, running: base });
}

export function pushAdd(
  steps: LedgerStep[],
  source: LedgerSource,
  amount: number,
  note?: LedgerNote,
): void {
  if (Math.abs(amount) < EPS) return;
  const previous = steps.at(-1);
  if (!previous) return;
  steps.push({ source, op: '+', amount, running: previous.running + amount, note });
}

/** Additive step derived from `percent% × base` (tree / points / combat crit pool). */
export function pushAddPctOfBase(
  steps: LedgerStep[],
  source: LedgerSource,
  percent: number,
  base: number,
  note?: LedgerNote,
): void {
  const amount = (percent / 100) * base;
  if (Math.abs(amount) < EPS) return;
  const previous = steps.at(-1);
  if (!previous) return;
  steps.push({
    source,
    op: '+',
    amount,
    running: previous.running + amount,
    note,
    pctOfBase: { percent, base },
  });
}

export function pushMul(
  steps: LedgerStep[],
  source: LedgerSource,
  factor: number,
  note?: LedgerNote,
  split?: { own: number; team: number },
): void {
  if (Math.abs(factor - 1) < EPS) return;
  const previous = steps.at(-1);
  if (!previous) return;
  steps.push({
    source,
    op: '×',
    amount: factor,
    running: previous.running * factor,
    note,
    splitOwn: split?.own,
    splitTeam: split?.team,
  });
}

/** Own/team split note for a combined additive team mult (before tempo). */
export function teamMultNote(
  combinedFactor: number,
  ownMult: number,
): { note?: LedgerNote; split?: { own: number; team: number } } {
  const combinedBonus = combinedFactor - 1;
  if (combinedBonus >= TEAM_MULT_BONUS_CAP - EPS) {
    return { note: 'capped' };
  }
  const own = Math.max(0, ownMult - 1) * 100;
  const team = Math.max(0, combinedBonus - (ownMult - 1)) * 100;
  if (own < EPS && team < EPS) return {};
  return { note: 'ownTeamSplit', split: { own, team } };
}

/** Fold ledger steps to the final running value (ESB-10). */
export function foldLedger(steps: LedgerStep[]): number {
  if (steps.length === 0) return 0;
  // MOD-36: genuine accumulator — folds each step's op onto the running total in sequence;
  // the running value depends on its own prior value, so a `reduce` copy would read the same.
  let running = steps[0].running;
  for (let index = 1; index < steps.length; index++) {
    const step = steps[index];
    running = step.op === '+' ? running + step.amount : running * step.amount;
  }
  return running;
}
