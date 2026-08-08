import { effectiveUpgrade } from '@bombfarm/domain/gear-plan';
import type { Loadout } from '@bombfarm/domain/gear';

/**
 * The plan forges every roster item to at least `forgeFloorApplied` — show that expected end
 * state on the proposed-gear icons, not each item's raw stored upgrade, so the badge matches
 * what the forge list is about to do rather than today's inventory snapshot.
 */
export function withExpectedForge(loadout: Loadout, forgeFloorApplied: number): Loadout {
  const out: Loadout = {};
  for (const [slot, item] of Object.entries(loadout)) {
    out[slot] = item ? { ...item, upgrade: effectiveUpgrade(item.upgrade, forgeFloorApplied) } : item;
  }
  return out;
}
