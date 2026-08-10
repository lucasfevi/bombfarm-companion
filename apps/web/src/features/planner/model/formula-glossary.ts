import type { Strings } from '@/shared/i18n';

type GlossEntry = { tokens: string[]; tipKey: keyof Strings };

/** Opaque abbreviations only — Effective-row labels (mitF, dmg, Hit, …) stay plain. */
export const FORMULA_GLOSSARY: Partial<Record<string, GlossEntry[]>> = {
  bdFormulaMitF: [
    { tokens: ['phaseMit'], tipKey: 'bdTermMit' },
    { tokens: ['pen'], tipKey: 'bdTermPen' },
  ],
  bdFormulaDmg: [
    { tokens: ['abl'], tipKey: 'bdTermAbl' },
    { tokens: ['extra'], tipKey: 'bdTermExtra' },
    { tokens: ['abisso'], tipKey: 'bdTermAbisso' },
  ],
  bdFormulaHit: [
    { tokens: ['atk'], tipKey: 'bdTermAtk' },
    { tokens: ['mit'], tipKey: 'bdTermMitigation' },
    { tokens: ['damage', 'dano'], tipKey: 'bdTermDamage' },
  ],
  bdFormulaCriticalHit: [{ tokens: ['cd'], tipKey: 'bdTermCd' }],
  bdFormulaCritFactor: [
    { tokens: ['cc'], tipKey: 'bdTermCc' },
    { tokens: ['cd'], tipKey: 'bdTermCd' },
  ],
  bdFormulaFuse: [{ tokens: ['cdr'], tipKey: 'bdTermCdr' }],
  bdFormulaBombsSerial: [{ tokens: ['walk', 'caminhada'], tipKey: 'bdTermWalk' }],
  bdFormulaBombsWiki: [{ tokens: ['sf'], tipKey: 'bdTermSf' }],
  bdFormulaField: [{ tokens: ['drain', 'dreno'], tipKey: 'bdTermDrain' }],
  bdFormulaRest: [{ tokens: ['restSeconds', 'descansoSegundos'], tipKey: 'bdTermRestSeconds' }],
  bdFormulaUptime: [
    { tokens: ['field', 'campo'], tipKey: 'bdTermField' },
    { tokens: ['rest', 'descanso'], tipKey: 'bdTermRestSecs' },
  ],
  bdFormulaActive: [
    { tokens: ['avg', 'médio'], tipKey: 'bdTermAvg' },
    { tokens: ['range', 'alcance'], tipKey: 'bdTermRange' },
    { tokens: ['damage', 'dano'], tipKey: 'bdTermDamage' },
  ],
  bdFormulaSustained: [
    { tokens: ['activeDPS', 'DPSativo'], tipKey: 'bdTermActiveDps' },
    { tokens: ['field', 'campo'], tipKey: 'bdTermField' },
    { tokens: ['rest', 'descanso'], tipKey: 'bdTermRestSecs' },
  ],
};

/**
 * Resolves a formula's glossary entries against the active language strings, producing the
 * token → tip map `GlossedText` needs. Empty when the expression has no glossary entry or every
 * mapped tip string is missing — `GlossedText` treats an empty map as the plain-wrapper case.
 */
export function resolveFormulaTerms(
  expressionKey: string,
  strings: Strings,
): ReadonlyMap<string, string> {
  const entries = FORMULA_GLOSSARY[expressionKey] ?? [];
  const tokenToTip = new Map<string, string>();
  for (const entry of entries) {
    const tip = strings[entry.tipKey];
    if (typeof tip !== 'string' || !tip) continue;
    for (const tok of entry.tokens) tokenToTip.set(tok, tip);
  }
  return tokenToTip;
}
