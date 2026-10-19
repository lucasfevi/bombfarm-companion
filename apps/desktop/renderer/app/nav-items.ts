import type { IconName } from '@bombfarm/ui';
import type { Copy } from '../lib/copy';

/** Every tab carries a glyph as well as a word: the top bar draws the glyph alone once the window
 *  is too narrow to spell its tabs, and a tab without one would keep its label and overflow. */
export function navItemsFor(
  t: Copy,
  { premium }: { premium: boolean },
): { id: string; label: string; icon: IconName }[] {
  return [
    { id: 'live', label: t.liveNavLabel, icon: 'signal' },
    { id: 'farm', label: t.farmNavLabel, icon: 'map' },
    // Beside the farm board on purpose: per-hero numbers are read off that board today.
    { id: 'heroes', label: t.heroesNavLabel, icon: 'user-group' },
    { id: 'inventory', label: t.inventoryNavLabel, icon: 'archive-box' },
    { id: 'forge', label: t.forgeNavLabel, icon: 'hammer' },
    { id: 'optimizer', label: t.optimizerNavLabel, icon: 'sparkles' },
    { id: 'pvp', label: t.pvpNavLabel, icon: 'sword' },
    // The skill tree and the collections share this tab: both are permanent, account-wide bonuses.
    { id: 'progression', label: t.progressionNavLabel, icon: 'graph' },
    ...(premium ? [{ id: 'premium', label: t.premiumNavLabel, icon: 'star' as const }] : []),
    { id: 'account', label: t.accountNavLabel, icon: 'user' },
  ];
}
