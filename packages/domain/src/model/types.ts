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
}

export type CycleModel = 'serial' | 'wiki';

export interface Context {
  restSeconds: number;
  mitigation: number; // 0..1 phase mitigation
  blastRange: number; // alcance; blocos/bomba = 1 + 0.5 × range. Base 1 for every hero, raised only by Explosão Ampla.
  cycleModel: CycleModel;
  walkDelay: number; // seconds between explosion and next plant (serial model)
  drainMult: number; // energy drain multiplier (<1 with Bateria Extra / Fôlego)
}

export type StatKey = 'energy' | 'attack' | 'critDmg' | 'speed' | 'critChance' | 'penetration' | 'cdr';

export const STAT_LABELS: Record<StatKey, string> = {
  energy: 'Energia',
  attack: 'Ataque',
  critDmg: 'Dano Crítico',
  speed: 'Velocidade',
  critChance: 'Chance de Crítico',
  penetration: 'Penetração',
  cdr: 'Red. de Cooldown',
};

export interface PointValue {
  stat: StatKey;
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

/** Per-point deltas on the effective combat sheet (from `derive`). */
export type EffectiveDeltas = Record<StatKey, number>;

export type RankMode = 'dps' | 'oneshot';

export interface RankOptions {
  bases?: PointBases;
  /** Marginal +1 pt on the effective sheet (shared-pool + mults + caps). */
  effectiveDeltas?: EffectiveDeltas;
  /** When set with mode=oneshot, boost hit-size stats near a prop breakpoint. */
  mode?: RankMode;
  targetPropHp?: number;
  /** Flat damage multiplier on hit size (tree × ability dmg mults). */
  hitDmgMult?: number;
  mitigation?: number;
}
