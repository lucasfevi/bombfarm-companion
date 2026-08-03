import {
  bombsPerSecond,
  critFactor,
  fieldSeconds,
  fuseSeconds,
  mitigationFactor,
  predictHitDamage,
} from '@/shared/domain/model';
import { formatBreakdownNumber } from '@/shared/domain/stat-breakdown/ledger-kit';
import type { FormulaBreakdown, PipelineFacts } from '@/shared/domain/stat-breakdown/types';

export function formulaMitF(facts: PipelineFacts): FormulaBreakdown {
  const mit = facts.context.mitigation;
  const pen = facts.effective.penetration;
  const value = mitigationFactor(mit, pen);
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaMitF',
    substituted: `1 − ${formatBreakdownNumber(mit, 4)} × (1 − ${formatBreakdownNumber(pen, 1)}/100) = ${formatBreakdownNumber(value, 4)}`,
    value,
  };
}

/**
 * BSP-23c/AC-42: `dmgMult` no longer carries `treeDanoTotal` — the tree's `dmg_static` factor
 * now lives on the sheet (`ledgerAttack`'s 'tree' step), applied exactly once. This formula's
 * substituted string must not imply a second application.
 */
export function formulaDmg(facts: PipelineFacts): FormulaBreakdown {
  const abl = facts.mods.dmgMult;
  const extra = 1 + facts.extraDmgPct / 100;
  const value = facts.dmgMult;
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaDmg',
    substituted: `${formatBreakdownNumber(abl, 3)} × ${formatBreakdownNumber(extra, 3)} = ${formatBreakdownNumber(value, 3)}`,
    value,
  };
}

export function formulaHit(facts: PipelineFacts): FormulaBreakdown {
  const atk = facts.effective.attack;
  const pen = facts.effective.penetration;
  const mitF = mitigationFactor(facts.context.mitigation, pen);
  const value = predictHitDamage(atk, facts.context.mitigation, pen, facts.dmgMult);
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaHit',
    substituted: `${formatBreakdownNumber(atk, 1)} × ${formatBreakdownNumber(mitF, 4)} × ${formatBreakdownNumber(facts.dmgMult, 3)} = ${formatBreakdownNumber(value, 0)}`,
    value,
  };
}

export function formulaCriticalHit(facts: PipelineFacts): FormulaBreakdown {
  const hit = predictHitDamage(
    facts.effective.attack,
    facts.context.mitigation,
    facts.effective.penetration,
    facts.dmgMult,
  );
  const critDmg = facts.effective.critDmg;
  const value = hit * (1 + critDmg / 100);
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaCriticalHit',
    substituted: `${formatBreakdownNumber(hit, 0)} × (1 + ${formatBreakdownNumber(critDmg, 1)}/100) = ${formatBreakdownNumber(value, 0)}`,
    value,
  };
}

export function formulaCritFactor(facts: PipelineFacts): FormulaBreakdown {
  const critChance = facts.effective.critChance;
  const critDmg = facts.effective.critDmg;
  const value = critFactor(critChance, critDmg);
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaCritFactor',
    substituted: `1 + (${formatBreakdownNumber(critChance, 1)}/100) × (${formatBreakdownNumber(critDmg, 1)}/100) = ${formatBreakdownNumber(value, 3)}`,
    value,
  };
}

export function formulaFuse(facts: PipelineFacts): FormulaBreakdown {
  const cdr = facts.effective.cdr;
  const value = fuseSeconds(cdr);
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaFuse',
    substituted: `max(2 × (1 − ${formatBreakdownNumber(cdr, 1)}/100), 0.6) = ${formatBreakdownNumber(value, 2)}s`,
    value,
  };
}

export function formulaBombs(facts: PipelineFacts): FormulaBreakdown {
  const value = bombsPerSecond(facts.effective, facts.context);
  if (facts.context.cycleModel === 'serial') {
    const fuse = fuseSeconds(facts.effective.cdr);
    return {
      kind: 'formula',
      expressionKey: 'bdFormulaBombsSerial',
      substituted: `1 / (${formatBreakdownNumber(fuse, 2)} + ${formatBreakdownNumber(facts.context.walkDelay, 2)}) = ${formatBreakdownNumber(value, 2)}/s`,
      value,
    };
  }
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaBombsWiki',
    substituted: `(0.3 + 0.12 × ${formatBreakdownNumber(facts.effective.speed, 1)} × 0.0386) × sf(${formatBreakdownNumber(facts.effective.energy, 1)}) = ${formatBreakdownNumber(value, 2)}/s`,
    value,
  };
}

export function formulaField(facts: PipelineFacts): FormulaBreakdown {
  const value = fieldSeconds(facts.effective, facts.context);
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaField',
    substituted: `${formatBreakdownNumber(facts.effective.energy, 1)} / ${formatBreakdownNumber(facts.context.drainMult, 2)} = ${formatBreakdownNumber(value, 0)}s (${formatBreakdownNumber(value / 60, 1)}m)`,
    value,
  };
}

export function formulaRest(facts: PipelineFacts): FormulaBreakdown {
  const value = facts.rest / 60;
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaRest',
    substituted: `${formatBreakdownNumber(facts.rest, 0)} / 60 = ${formatBreakdownNumber(value, 1)}m`,
    value,
  };
}

export function formulaUptime(facts: PipelineFacts): FormulaBreakdown {
  const field = fieldSeconds(facts.effective, facts.context);
  const value = facts.uptime;
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaUptime',
    substituted: `100 × ${formatBreakdownNumber(field, 0)} / (${formatBreakdownNumber(field, 0)} + ${formatBreakdownNumber(facts.rest, 0)}) = ${formatBreakdownNumber(value, 1)}%`,
    value,
  };
}

export function formulaActive(facts: PipelineFacts): FormulaBreakdown {
  const effective = facts.effective;
  const mitF = mitigationFactor(facts.context.mitigation, effective.penetration);
  const factor = critFactor(effective.critChance, effective.critDmg);
  const average = effective.attack * mitF * factor;
  const bombs = bombsPerSecond(effective, facts.context);
  const range = facts.context.blastRange;
  const value = facts.active;
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaActive',
    substituted: `${formatBreakdownNumber(average, 0)} × ${formatBreakdownNumber(bombs, 2)} × (1 + 0.5 × ${formatBreakdownNumber(range, 1)}) × 0.9 × ${formatBreakdownNumber(facts.dmgMult, 3)} = ${formatBreakdownNumber(value, 0)}`,
    value,
  };
}

export function formulaSustained(facts: PipelineFacts): FormulaBreakdown {
  const field = fieldSeconds(facts.effective, facts.context);
  const value = facts.dps;
  const active = facts.active;
  return {
    kind: 'formula',
    expressionKey: 'bdFormulaSustained',
    substituted: `${formatBreakdownNumber(active, 0)} × (${formatBreakdownNumber(field, 0)} / (${formatBreakdownNumber(field, 0)} + ${formatBreakdownNumber(facts.rest, 0)})) = ${formatBreakdownNumber(value, 0)}`,
    value,
  };
}
