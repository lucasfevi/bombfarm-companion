import type { SheetKey } from '@bombfarm/domain/planner-constants';

/**
 * Three-letter codes for the eight sheet stats, the same in every language.
 *
 * Codes rather than the first three letters of the translated name, because the names collide
 * once cut — crit chance, crit damage and cooldown all opened `Cri`/`Coo` in English and worse in
 * Portuguese. They live here rather than in copy for the same reason: a code that changed per
 * language would stop being the one the hover reveals the full name of.
 */
export const SHEET_STAT_CODES: Record<SheetKey, string> = {
  attack: 'ATK',
  energy: 'ENE',
  speed: 'SPD',
  luck: 'LCK',
  critChance: 'CrC',
  critDmg: 'CrD',
  penetration: 'PEN',
  cdr: 'CDR',
};
