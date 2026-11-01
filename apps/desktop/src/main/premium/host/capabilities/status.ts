import type { PremiumStatusAnswer } from '@bombfarm/contracts';
import type { CapabilityHandler } from '../capability-channel.js';

export interface StatusCapabilityDeps {
  /** What the app already holds about Premium; null before any answer. */
  premiumStatus(): { readonly active: boolean; readonly until: string | null } | null;
  /** The signed-in user's audience; null when unknown. */
  audience(): PremiumStatusAnswer['audience'] | null;
}

/**
 * `premium.status`: whether Premium is active and until when, and the audience. The channel refuses
 * every call while paused, so an answered status is never paused; the reason reaches the bundle on
 * the `paused` event. The fields stay in the answer so its shape does not change when that does.
 */
export function createStatusCapability(deps: StatusCapabilityDeps): CapabilityHandler {
  return (): PremiumStatusAnswer => {
    const held = deps.premiumStatus();
    return {
      active: held?.active ?? false,
      until: held?.until ?? null,
      paused: false,
      pausedReason: null,
      audience: deps.audience() ?? 'public',
    };
  };
}
