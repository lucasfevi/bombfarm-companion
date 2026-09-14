import {
  bombsPerSecond,
  critFactor,
  cycleSecondsForHero,
  EFF_IA,
  fieldSeconds,
  FUSE_FLOOR,
  fuseSeconds,
  GRID_SPEED_COEF,
  mitigationFactor,
  predictHitDamage,
} from '../model';
import { formatBreakdownNumber } from './ledger-kit';
import type { FormulaBreakdown, FormulaPart, FormulaTerm, FormulaTermKey, PipelineFacts } from './types';

function term(key: FormulaTermKey, value: number, digits: number): FormulaTerm {
  return { key, value, text: formatBreakdownNumber(value, digits) };
}

/**
 * A tagged template: the literal pieces between the terms are kept as plain strings, so
 * `substituted` is the same characters a reader would type, and `parts` is that string with
 * each term still knowing which input it was.
 */
function formula(expressionKey: string, value: number) {
  return (strings: TemplateStringsArray, ...terms: (FormulaTerm | string)[]): FormulaBreakdown => {
    const parts: FormulaPart[] = [];
    strings.forEach((literal, index) => {
      if (literal) parts.push(literal);
      const next = terms[index];
      if (next !== undefined) parts.push(next);
    });
    const substituted = parts.map((part) => (typeof part === 'string' ? part : part.text)).join('');
    return { kind: 'formula', expressionKey, substituted, parts, value };
  };
}

export function formulaMitF(facts: PipelineFacts): FormulaBreakdown {
  const mit = facts.context.mitigation;
  const pen = facts.effective.penetration;
  const value = mitigationFactor(mit, pen);
  return formula('bdFormulaMitF', value)`1 − ${term('phaseMit', mit, 4)} × (1 − ${term('penetration', pen, 1)}/100) = ${formatBreakdownNumber(value, 4)}`;
}

/**
 * `dmgMult` no longer carries `treeDanoTotal` — the tree's `dmg_static` factor
 * now lives on the sheet (`ledgerAttack`'s 'tree' step), applied exactly once. This formula's
 * substituted string must not imply a second application.
 */
export function formulaDmg(facts: PipelineFacts): FormulaBreakdown {
  const abl = facts.mods.dmgMult;
  const pack = facts.packMult;
  const extra = 1 + facts.extraDmgPct / 100;
  const pulse = facts.entryPulseMult ?? 1;
  const value = facts.dmgMult;
  if (pulse === 1) {
    return formula('bdFormulaDmg', value)`${term('abilities', abl, 3)} × ${term('pack', pack, 3)} × ${term('extra', extra, 3)} = ${formatBreakdownNumber(value, 3)}`;
  }
  return formula('bdFormulaDmg', value)`${term('abilities', abl, 3)} × ${term('pack', pack, 3)} × ${term('extra', extra, 3)} × ${term('pulse', pulse, 3)} = ${formatBreakdownNumber(value, 3)}`;
}

function hitDamage(facts: PipelineFacts): number {
  return predictHitDamage(
    facts.effective.attack,
    facts.context.mitigation,
    facts.effective.penetration,
    facts.dmgMult,
  );
}

export function formulaHit(facts: PipelineFacts): FormulaBreakdown {
  const atk = facts.effective.attack;
  const mitF = mitigationFactor(facts.context.mitigation, facts.effective.penetration);
  const value = hitDamage(facts);
  return formula('bdFormulaHit', value)`${term('attack', atk, 1)} × ${term('mitF', mitF, 4)} × ${term('dmg', facts.dmgMult, 3)} = ${formatBreakdownNumber(value, 0)}`;
}

export function formulaCriticalHit(facts: PipelineFacts): FormulaBreakdown {
  const hit = hitDamage(facts);
  const critDmg = facts.effective.critDmg;
  const value = hit * (1 + critDmg / 100);
  return formula('bdFormulaCriticalHit', value)`${term('hit', hit, 0)} × (1 + ${term('critDmg', critDmg, 1)}/100) = ${formatBreakdownNumber(value, 0)}`;
}

export function formulaAvgHit(facts: PipelineFacts): FormulaBreakdown {
  const hit = hitDamage(facts);
  const factor = critFactor(facts.effective.critChance, facts.effective.critDmg);
  const value = hit * factor;
  return formula('bdFormulaAvgHit', value)`${term('hit', hit, 0)} × ${term('critFactor', factor, 3)} = ${formatBreakdownNumber(value, 0)}`;
}

export function formulaCritFactor(facts: PipelineFacts): FormulaBreakdown {
  const critChance = facts.effective.critChance;
  const critDmg = facts.effective.critDmg;
  const value = critFactor(critChance, critDmg);
  return formula('bdFormulaCritFactor', value)`1 + (${term('critChance', critChance, 1)}/100) × (${term('critDmg', critDmg, 1)}/100) = ${formatBreakdownNumber(value, 3)}`;
}

export function formulaFuse(facts: PipelineFacts): FormulaBreakdown {
  const cdr = facts.effective.cdr;
  const value = fuseSeconds(cdr);
  return formula('bdFormulaFuse', value)`max(2 × (1 − ${term('cdr', cdr, 1)}/100), ${term('fuseFloor', FUSE_FLOOR, 1)}) = ${formatBreakdownNumber(value, 2)}s`;
}

export function formulaBombs(facts: PipelineFacts): FormulaBreakdown {
  const value = bombsPerSecond(facts.effective, facts.context);
  const fuse = fuseSeconds(facts.effective.cdr);
  const walk = facts.effective.speed * GRID_SPEED_COEF;
  const cycle = cycleSecondsForHero(fuse, walk, facts.context.ato);
  return formula('bdFormulaBombs', value)`1 / cycle(${term('fuse', fuse, 2)}s, ${term('walk', walk, 2)}/s, ${term('band', facts.context.ato, 0)}) = 1 / ${term('cycle', cycle, 2)}s = ${formatBreakdownNumber(value, 2)}/s`;
}

export function formulaField(facts: PipelineFacts): FormulaBreakdown {
  const value = fieldSeconds(facts.effective, facts.context);
  return formula('bdFormulaField', value)`${term('energy', facts.effective.energy, 1)} / ${term('drain', facts.context.drainMult, 2)} = ${formatBreakdownNumber(value, 0)}s (${formatBreakdownNumber(value / 60, 1)}m)`;
}

export function formulaRest(facts: PipelineFacts): FormulaBreakdown {
  const value = facts.rest / 60;
  return formula('bdFormulaRest', value)`${term('restSeconds', facts.rest, 0)} / 60 = ${formatBreakdownNumber(value, 1)}m`;
}

export function formulaUptime(facts: PipelineFacts): FormulaBreakdown {
  const field = fieldSeconds(facts.effective, facts.context);
  const value = facts.uptime;
  return formula('bdFormulaUptime', value)`100 × ${term('field', field, 0)} / (${term('field', field, 0)} + ${term('restSeconds', facts.rest, 0)}) = ${formatBreakdownNumber(value, 1)}%`;
}

/** The average hit already carries the damage multiplier (it is `hit × critFactor`), so the
 *  multiplier is not a second factor here — `derive()` applies it once, to the same product. */
export function formulaActive(facts: PipelineFacts): FormulaBreakdown {
  const effective = facts.effective;
  const average = hitDamage(facts) * critFactor(effective.critChance, effective.critDmg);
  const bombs = bombsPerSecond(effective, facts.context);
  const rangeMult = 1 + 0.5 * facts.context.blastRange;
  const value = facts.active;
  return formula('bdFormulaActive', value)`${term('avgHit', average, 0)} × ${term('bombs', bombs, 2)} × ${term('rangeMult', rangeMult, 2)} × ${term('aiEfficiency', EFF_IA, 1)} = ${formatBreakdownNumber(value, 0)}`;
}

export function formulaSustained(facts: PipelineFacts): FormulaBreakdown {
  const field = fieldSeconds(facts.effective, facts.context);
  const value = facts.dps;
  return formula('bdFormulaSustained', value)`${term('activeDps', facts.active, 0)} × (${term('field', field, 0)} / (${term('field', field, 0)} + ${term('restSeconds', facts.rest, 0)})) = ${formatBreakdownNumber(value, 0)}`;
}
