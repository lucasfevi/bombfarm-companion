import type { Copy } from '../lib/copy';

export function navItemsFor(t: Copy) {
  return [
    { id: 'live', label: t.liveNavLabel },
    { id: 'inventory', label: t.inventoryNavLabel },
    { id: 'settings', label: t.settingsNavLabel },
  ];
}
