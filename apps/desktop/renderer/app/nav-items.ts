import type { AppFlavor } from '@bombfarm/contracts';
import type { Copy } from '../lib/copy';

/**
 * Diagnostics renders the raw account payload, which is a maintainer's tool and of no use to a
 * player — so it is offered only once the flavor is known to be one of the development ones. An
 * unknown flavor is treated as production: the environment arrives asynchronously, and erring the
 * other way would flash the tab into a shipped build's nav before removing it.
 */
export function navItemsFor(flavor: AppFlavor | null, t: Copy) {
  const offerDiagnostics = flavor !== null && flavor !== 'prod';
  return [
    { id: 'planning', label: t.shellPlanningNavLabel, icon: 'check-circle' as const },
    ...(offerDiagnostics
      ? [{ id: 'diagnostics', label: t.shellDiagnosticsNavLabel, icon: 'information-circle' as const }]
      : []),
    // packages/ui's icon registry has no dedicated "settings" glyph and must not gain one, so
    // 'arrow-path' is reused rather than widening the registry.
    { id: 'settings', label: t.settingsNavLabel, icon: 'arrow-path' as const },
  ];
}
