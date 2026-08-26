import type { Copy } from '../lib/copy';

export function navItemsFor(t: Copy) {
  return [
    { id: 'live', label: t.liveNavLabel },
    { id: 'planning', label: t.shellPlanningNavLabel },
    { id: 'settings', label: t.settingsNavLabel },
  ];
}
