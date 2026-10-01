import type { RarityKey } from './rarity-constants';

export interface HeroSheet {
  rarity: RarityKey;
  attack: number;
  energy: number;
  speed: number;
  critChance: number; // %
  critDmg: number; // +%
  penetration: number; // %
  cdr: number; // % (sheet Red. de Recarga)
  // effective sheet gain when spending one point (gear/tree amplified);
  // measure in-game by spending a point and reading the sheet delta.
  attackPerPoint: number;
  energyPerPoint: number;
  /** A planner's ceiling on the crit chance DPS credits (`readCritChance`); the sheet keeps its
   *  own value. Absent, the plain cap is the only limit. */
  critCeiling?: number;
}

export interface Context {
  restSeconds: number;
  mitigation: number; // 0..1 phase mitigation
  blastRange: number; // alcance; blocos/bomba = 1 + 0.5 × range. Whole cells: base 1, raised only by Explosão Ampla (at levels 10 and 20), whose cells deal EXTRA_RANGE_FRAC of the hit — damage reads `damageWeightedBlastRange`.
  ato: number; // difficulty band (1..5) of the phase being priced — selects the prop count the bomb cycle is priced over
  drainMult: number; // energy drain multiplier (<1 with Bateria Extra / Fôlego)
  /**
   * A timed combat window, in seconds — a gate clear, a duel — that the hero enters at full
   * energy. Set, `sustainedDps` averages over this window instead of over an endless rotation:
   * energy past what the window can spend earns nothing. Absent, the horizon is infinite.
   */
  windowSecs?: number;
}

export type StatKey = 'energy' | 'attack' | 'critDmg' | 'speed' | 'critChance' | 'penetration' | 'cdr';

/** A stat a Next point ranking can name: the seven combat stats, plus Luck where the objective
 *  prices drops (the farm ranking). */
export type RankStatKey = StatKey | 'luck';

export const STAT_LABELS: Record<RankStatKey, string> = {
  energy: 'Energia',
  attack: 'Ataque',
  critDmg: 'Dano Crítico',
  speed: 'Velocidade',
  critChance: 'Chance de Crítico',
  penetration: 'Penetração',
  cdr: 'Red. de Cooldown',
  luck: 'Sorte',
};

export interface PointValue {
  stat: RankStatKey;
  label: string;
  gainPct: number;
}

/** Base values the % point gains scale off (naked sheet ≈ base roll proxy). */
export interface PointBases {
  speed: number;
  critChance: number;
  critDmg: number;
  penetration: number;
  cdr: number;
}

/** Per-point deltas on the effective combat sheet (from `derive`). `luck` is PERCENTAGE POINTS
 *  of Sorte per point — no combat stat reads it; the farm scorer prices it into drop rates. */
export type EffectiveDeltas = Record<StatKey, number> & { luck?: number };

export type RankMode = 'dps' | 'farm';

export interface RankOptions {
  bases?: PointBases;
  /** Marginal +1 pt on the effective sheet (shared-pool + mults + caps). */
  effectiveDeltas?: EffectiveDeltas;
}
