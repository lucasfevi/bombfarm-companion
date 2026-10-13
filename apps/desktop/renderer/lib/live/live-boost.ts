import type { LiveBoostAxis } from '@bombfarm/contracts';
import { NO_ECONOMY_BOOST, type EconomyBoost } from '@bombfarm/domain/farm-rate';

export function economyBoostOf(axes: readonly LiveBoostAxis[]): EconomyBoost {
  if (axes.length === 0) return NO_ECONOMY_BOOST;
  return { gold: axes.includes('gold'), xp: axes.includes('xp'), drop: axes.includes('drop') };
}
