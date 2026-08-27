import { isGranted } from '@bombfarm/game-api';
import type { ConsentStore } from './consent-store.js';

/**
 * The tap re-reads this on every poll rather than capturing a decision, so a revoke takes effect
 * on the next tick instead of at the next restart.
 */
export function createLiveConsentGate(store: ConsentStore | null): () => boolean {
  return () => (store ? isGranted(store.read()) : false);
}
