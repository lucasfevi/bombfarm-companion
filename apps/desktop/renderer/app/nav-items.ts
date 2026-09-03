import type { IconName } from '@bombfarm/ui';
import type { Copy } from '../lib/copy';

/** Every tab carries a glyph as well as a word: the top bar draws the glyph alone once the window
 *  is too narrow to spell five tabs, and a tab without one would keep its label and overflow. */
export function navItemsFor(t: Copy): { id: string; label: string; icon: IconName }[] {
  return [
    { id: 'live', label: t.liveNavLabel, icon: 'signal' },
    { id: 'farm', label: t.farmNavLabel, icon: 'map' },
    { id: 'inventory', label: t.inventoryNavLabel, icon: 'archive-box' },
    { id: 'account', label: t.accountNavLabel, icon: 'user' },
    { id: 'settings', label: t.settingsNavLabel, icon: 'cog' },
  ];
}
