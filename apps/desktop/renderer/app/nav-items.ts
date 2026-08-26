import type { Copy } from '../lib/copy';

export function navItemsFor(t: Copy) {
  return [
    { id: 'live', label: t.liveNavLabel, icon: 'information-circle' as const },
    { id: 'planning', label: t.shellPlanningNavLabel, icon: 'check-circle' as const },
    // packages/ui's icon registry has no dedicated "settings" glyph and must not gain one, so
    // 'arrow-path' is reused rather than widening the registry.
    { id: 'settings', label: t.settingsNavLabel, icon: 'arrow-path' as const },
  ];
}
