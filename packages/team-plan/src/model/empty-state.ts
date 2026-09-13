import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { countOptimizeScopeHeroes } from '../core/hero-scope';
import type { ScopeState } from '../core/hero-scope';

export type TeamPlanEmptyStateKind = 'noRoster' | 'noInventory' | 'allLeaveAlone';

/** Precedence: no roster beats no inventory beats every hero being Leave alone. */
export function teamPlanEmptyState(
  heroes: readonly HeroRecord[],
  inventoryItems: readonly InventoryItem[],
  scopeByHeroId: Record<string, ScopeState>,
): TeamPlanEmptyStateKind | null {
  if (heroes.length === 0) return 'noRoster';
  if (inventoryItems.length === 0) return 'noInventory';
  if (countOptimizeScopeHeroes(heroes, scopeByHeroId) === 0) return 'allLeaveAlone';
  return null;
}
