import { isPlainObject } from '../type-guards.js';
import { wireKey, type PhaseEconomyWireSymbol } from './lexicon.js';

/** What the server says one phase pays and drops, with the account's multipliers already in it. */
export interface PhaseEconomy {
  readonly phase: number;
  readonly goldPerProp: number;
  readonly xpPerProp: number;
  readonly goldMult: number | null;
  readonly xpMult: number | null;
  readonly itemLevelMin: number;
  readonly itemLevelMax: number;
  readonly chestChancePct: number;
  readonly keyChancePct: number | null;
  readonly gemChancePct: number | null;
  readonly stoneChancePct: number | null;
  readonly timeChancePct: number | null;
  readonly cageCeilingPct: number;
}

/** Keys the lexicon does not declare are counted, not refused: the body has already grown one
 *  key between observations, and it is only ever a cross-check. */
export interface PhaseEconomyRead {
  readonly economy: PhaseEconomy;
  readonly ignored: number;
}

const DECLARED_SYMBOLS: readonly PhaseEconomyWireSymbol[] = [
  'phase',
  'goldPerProp',
  'xpPerProp',
  'goldMult',
  'xpMult',
  'itemLevelMin',
  'itemLevelMax',
  'chestChancePct',
  'chestRollChancePct',
  'keyChancePct',
  'gemChancePct',
  'stoneChancePct',
  'timeChancePct',
  'cageCeilingPct',
];
const DECLARED_KEYS: ReadonlySet<string> = new Set(DECLARED_SYMBOLS.map(wireKey));

function finiteNumber(body: Record<string, unknown>, symbol: PhaseEconomyWireSymbol): number | null {
  const value = body[wireKey(symbol)];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** `undefined` for an absent key, `null` for one present with the wrong shape — an optional key
 *  that arrives malformed still fails the read. */
function optionalNumber(body: Record<string, unknown>, symbol: PhaseEconomyWireSymbol): number | null | undefined {
  if (!Object.hasOwn(body, wireKey(symbol))) return undefined;
  return finiteNumber(body, symbol);
}

function digitString(body: Record<string, unknown>, symbol: PhaseEconomyWireSymbol): number | null {
  const value = body[wireKey(symbol)];
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;
}

/**
 * The body is told apart by the pair only it carries: a per-prop gold as a digit string beside a
 * per-prop XP as a number. Neither key appears on any account section or on the live frame.
 */
export function isPhaseEconomyBody(body: unknown): boolean {
  return isPlainObject(body) && digitString(body, 'goldPerProp') !== null && finiteNumber(body, 'xpPerProp') !== null;
}

export function readPhaseEconomy(body: unknown): PhaseEconomyRead | null {
  if (!isPlainObject(body)) return null;

  const phase = finiteNumber(body, 'phase');
  const goldPerProp = digitString(body, 'goldPerProp');
  const xpPerProp = finiteNumber(body, 'xpPerProp');
  const itemLevelMin = finiteNumber(body, 'itemLevelMin');
  const itemLevelMax = finiteNumber(body, 'itemLevelMax');
  const chestChancePct = finiteNumber(body, 'chestChancePct');
  const cageCeilingPct = finiteNumber(body, 'cageCeilingPct');
  if (
    phase === null ||
    !Number.isInteger(phase) ||
    phase < 1 ||
    goldPerProp === null ||
    xpPerProp === null ||
    itemLevelMin === null ||
    itemLevelMax === null ||
    chestChancePct === null ||
    cageCeilingPct === null
  ) {
    return null;
  }

  const optional = {
    goldMult: optionalNumber(body, 'goldMult'),
    xpMult: optionalNumber(body, 'xpMult'),
    keyChancePct: optionalNumber(body, 'keyChancePct'),
    gemChancePct: optionalNumber(body, 'gemChancePct'),
    stoneChancePct: optionalNumber(body, 'stoneChancePct'),
    timeChancePct: optionalNumber(body, 'timeChancePct'),
    chestRollChancePct: optionalNumber(body, 'chestRollChancePct'),
  };
  if (Object.values(optional).some((value) => value === null)) return null;

  return {
    economy: {
      phase,
      goldPerProp,
      xpPerProp,
      goldMult: optional.goldMult ?? null,
      xpMult: optional.xpMult ?? null,
      itemLevelMin,
      itemLevelMax,
      chestChancePct,
      keyChancePct: optional.keyChancePct ?? null,
      gemChancePct: optional.gemChancePct ?? null,
      stoneChancePct: optional.stoneChancePct ?? null,
      timeChancePct: optional.timeChancePct ?? null,
      cageCeilingPct,
    },
    ignored: Object.keys(body).filter((key) => !DECLARED_KEYS.has(key)).length,
  };
}
